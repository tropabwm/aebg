import torch
from transformers import AutoModelForImageSegmentation
from torchvision import transforms
from PIL import Image
import numpy as np
import cv2
import os
import sys
import json
import tempfile
from moviepy.editor import VideoFileClip, ImageSequenceClip
import argparse

# Set device
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# Global variables for models
birefnet = None
birefnet_lite = None

def load_models():
    """Load BiRefNet models with caching"""
    global birefnet, birefnet_lite
    
    if birefnet is None or birefnet_lite is None:
        try:
            print("Loading BiRefNet models...")
            
            # Create models directory if it doesn't exist
            models_dir = os.path.join(os.path.dirname(__file__), 'models')
            os.makedirs(models_dir, exist_ok=True)
            
            # Load models with local caching
            cache_dir = models_dir
            
            print("Loading BiRefNet...")
            birefnet = AutoModelForImageSegmentation.from_pretrained(
                "ZhengPeng7/BiRefNet", 
                trust_remote_code=True,
                cache_dir=cache_dir
            )
            birefnet.to(device)
            birefnet.eval()
            
            print("Loading BiRefNet Lite...")
            birefnet_lite = AutoModelForImageSegmentation.from_pretrained(
                "ZhengPeng7/BiRefNet_lite", 
                trust_remote_code=True,
                cache_dir=cache_dir
            )
            birefnet_lite.to(device)
            birefnet_lite.eval()
            
            print("Models loaded successfully")
            
        except Exception as e:
            print(f"Error loading models: {e}")
            sys.exit(1)
    
    return birefnet, birefnet_lite

# Image transformation
transform_image = transforms.Compose([
    transforms.Resize((1024, 1024)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

def process_frame(image, background, fast_mode=True):
    """Process a single frame to remove background"""
    try:
        # Load models if not already loaded
        birefnet_model, birefnet_lite_model = load_models()
        
        image_size = image.size
        input_images = transform_image(image).unsqueeze(0).to(device)
        model = birefnet_lite_model if fast_mode else birefnet_model
        
        with torch.no_grad():
            preds = model(input_images)[-1].sigmoid().cpu()
        
        pred = preds[0].squeeze()
        pred_pil = transforms.ToPILImage()(pred)
        mask = pred_pil.resize(image_size)
        
        # Handle different background types
        if isinstance(background, str) and background.startswith("#"):
            # Color background
            color_rgb = tuple(int(background[i:i+2], 16) for i in (1, 3, 5))
            bg_image = Image.new("RGBA", image_size, color_rgb + (255,))
        elif isinstance(background, Image.Image):
            # Image background
            bg_image = background.convert("RGBA").resize(image_size)
        else:
            # Default transparent background
            bg_image = Image.new("RGBA", image_size, (0, 0, 0, 0))
        
        # Composite the image
        image_rgba = image.convert("RGBA")
        result = Image.composite(image_rgba, bg_image, mask)
        
        # Convert back to RGB for video processing
        if background is None or (isinstance(background, str) and background == "transparent"):
            return result  # Keep RGBA for transparency
        else:
            return result.convert("RGB")
    
    except Exception as e:
        print(f"Error processing frame: {e}")
        return image.convert("RGB")

def process_video(input_path, output_path, background_type="transparent", background_value=None, fast_mode=True, quality="high"):
    """Process video to remove background"""
    try:
        print(f"Processing video: {input_path}")
        print(f"Background type: {background_type}")
        print(f"Fast mode: {fast_mode}")
        print(f"Quality: {quality}")
        
        # Load models first
        load_models()
        
        # Load video
        video = VideoFileClip(input_path)
        fps = video.fps
        duration = video.duration
        
        print(f"Video info - FPS: {fps}, Duration: {duration}s")
        
        # Prepare background
        background = None
        if background_type == "color" and background_value:
            background = background_value
        elif background_type == "image" and background_value:
            if os.path.exists(background_value):
                background = Image.open(background_value)
            else:
                print(f"Warning: Background image not found: {background_value}")
                background = None
        
        # Process frames
        processed_frames = []
        frame_count = 0
        total_frames = int(fps * duration)
        
        print(f"Processing {total_frames} frames...")
        
        # Process video frame by frame
        for t in np.arange(0, duration, 1.0/fps):
            frame_count += 1
            
            try:
                # Get frame at time t
                frame = video.get_frame(t)
                
                # Convert frame to PIL Image
                pil_frame = Image.fromarray(frame.astype('uint8'), 'RGB')
                
                # Process frame
                processed_frame = process_frame(pil_frame, background, fast_mode)
                
                # Convert back to numpy array
                if processed_frame.mode == 'RGBA':
                    # Handle transparency by converting to RGB with white background
                    white_bg = Image.new('RGB', processed_frame.size, (255, 255, 255))
                    processed_frame = Image.alpha_composite(white_bg.convert('RGBA'), processed_frame).convert('RGB')
                
                processed_frames.append(np.array(processed_frame))
                
                # Progress update
                if frame_count % 50 == 0 or frame_count == total_frames:
                    progress = (frame_count / total_frames) * 100
                    print(f"Progress: {progress:.1f}% ({frame_count}/{total_frames})")
                    
            except Exception as e:
                print(f"Error processing frame {frame_count}: {e}")
                # Use original frame if processing fails
                processed_frames.append(frame)
        
        print("Creating output video...")
        
        # Create output video
        processed_video = ImageSequenceClip(processed_frames, fps=fps)
        
        # Add audio if present
        if video.audio:
            processed_video = processed_video.set_audio(video.audio)
        
        # Set quality parameters
        codec = "libx264"
        if quality == "high":
            bitrate = "8000k"
        elif quality == "medium":
            bitrate = "4000k"
        else:
            bitrate = "2000k"
        
        # Write video
        processed_video.write_videofile(
            output_path,
            codec=codec,
            bitrate=bitrate,
            audio_codec="aac",
            temp_audiofile=None,
            remove_temp=True,
            verbose=False,
            logger=None,
            threads=4
        )
        
        # Cleanup
        video.close()
        processed_video.close()
        
        print(f"Video processed successfully: {output_path}")
        return True
        
    except Exception as e:
        print(f"Error processing video: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(description='Remove background from video')
    parser.add_argument('--input', required=True, help='Input video path')
    parser.add_argument('--output', required=True, help='Output video path')
    parser.add_argument('--background-type', default='transparent', choices=['transparent', 'color', 'image'])
    parser.add_argument('--background-value', help='Background color (hex) or image path')
    parser.add_argument('--fast-mode', action='store_true', help='Use fast mode (BiRefNet_lite)')
    parser.add_argument('--quality', default='high', choices=['low', 'medium', 'high'])
    
    args = parser.parse_args()
    
    success = process_video(
        args.input,
        args.output,
        args.background_type,
        args.background_value,
        args.fast_mode,
        args.quality
    )
    
    if success:
        print("SUCCESS")
        sys.exit(0)
    else:
        print("FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()