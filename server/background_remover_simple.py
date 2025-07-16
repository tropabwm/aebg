#!/usr/bin/env python3
"""
Simple background remover using rembg library
More stable than BiRefNet for production use
"""

import sys
import os
import argparse
import json
from pathlib import Path

def install_rembg():
    """Install rembg if not available"""
    try:
        import rembg
        return True
    except ImportError:
        print("Installing rembg...")
        import subprocess
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg[new]"])
            import rembg
            return True
        except Exception as e:
            print(f"Failed to install rembg: {e}")
            return False

def process_video_simple(input_path, output_path, background_type="transparent", background_value=None):
    """Process video with simple background removal"""
    try:
        # Install rembg if needed
        if not install_rembg():
            print("ERROR: Could not install rembg")
            return False
            
        import rembg
        from rembg import remove
        import cv2
        import numpy as np
        from PIL import Image
        
        print(f"Processing video: {input_path}")
        print(f"Output: {output_path}")
        print(f"Background type: {background_type}")
        
        # Open video
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            print(f"ERROR: Could not open video: {input_path}")
            return False
            
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"Video info: {width}x{height}, {fps} FPS, {total_frames} frames")
        
        # Setup video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            print(f"ERROR: Could not create output video: {output_path}")
            return False
        
        # Prepare background
        background_img = None
        if background_type == "color" and background_value:
            # Convert hex to RGB
            hex_color = background_value.lstrip('#')
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            background_img = np.full((height, width, 3), rgb[::-1], dtype=np.uint8)  # BGR for OpenCV
        elif background_type == "image" and background_value and os.path.exists(background_value):
            bg_pil = Image.open(background_value).convert('RGB')
            bg_pil = bg_pil.resize((width, height))
            background_img = cv2.cvtColor(np.array(bg_pil), cv2.COLOR_RGB2BGR)
        
        # Process frames
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            
            try:
                # Convert frame to PIL Image
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                
                # Remove background
                result = remove(pil_image)
                
                # Handle different background types
                if background_type == "transparent":
                    # Convert RGBA to RGB with white background
                    if result.mode == 'RGBA':
                        white_bg = Image.new('RGB', result.size, (255, 255, 255))
                        result = Image.alpha_composite(white_bg.convert('RGBA'), result).convert('RGB')
                elif background_img is not None:
                    # Composite with custom background
                    if result.mode == 'RGBA':
                        # Extract alpha channel
                        alpha = np.array(result)[:, :, 3] / 255.0
                        result_rgb = np.array(result.convert('RGB'))
                        
                        # Blend with background
                        for c in range(3):
                            result_rgb[:, :, c] = (alpha * result_rgb[:, :, c] + 
                                                 (1 - alpha) * background_img[:, :, c])
                        
                        result = Image.fromarray(result_rgb.astype(np.uint8))
                
                # Convert back to OpenCV format
                result_cv = cv2.cvtColor(np.array(result), cv2.COLOR_RGB2BGR)
                out.write(result_cv)
                
                # Progress update
                if frame_count % 30 == 0 or frame_count == total_frames:
                    progress = (frame_count / total_frames) * 100
                    print(f"Progress: {progress:.1f}% ({frame_count}/{total_frames})")
                    
            except Exception as e:
                print(f"Error processing frame {frame_count}: {e}")
                # Use original frame if processing fails
                out.write(frame)
        
        # Cleanup
        cap.release()
        out.release()
        
        print(f"SUCCESS: Video processed successfully: {output_path}")
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(description='Remove background from video (simple version)')
    parser.add_argument('--input', required=True, help='Input video path')
    parser.add_argument('--output', required=True, help='Output video path')
    parser.add_argument('--background-type', default='transparent', choices=['transparent', 'color', 'image'])
    parser.add_argument('--background-value', help='Background color (hex) or image path')
    
    args = parser.parse_args()
    
    success = process_video_simple(
        args.input,
        args.output,
        args.background_type,
        args.background_value
    )
    
    if success:
        print("SUCCESS")
        sys.exit(0)
    else:
        print("FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()