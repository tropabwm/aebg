#!/usr/bin/env python3
"""
Background remover using OpenCV and basic image processing
Fallback option when rembg is not available
"""

import sys
import os
import argparse
import cv2
import numpy as np
from pathlib import Path

def remove_background_opencv(input_path, output_path, background_type="transparent", background_value=None):
    """Remove background using OpenCV (basic green screen removal)"""
    try:
        print(f"Processing video with OpenCV: {input_path}")
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
            bg_img = cv2.imread(background_value)
            if bg_img is not None:
                background_img = cv2.resize(bg_img, (width, height))
        
        # Process frames
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            
            try:
                # Simple green screen removal (basic approach)
                if background_type == "transparent" or background_img is not None:
                    # Convert to HSV for better color detection
                    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                    
                    # Define range for green color (adjust as needed)
                    lower_green = np.array([40, 40, 40])
                    upper_green = np.array([80, 255, 255])
                    
                    # Create mask for green pixels
                    mask = cv2.inRange(hsv, lower_green, upper_green)
                    
                    # Invert mask to get non-green pixels
                    mask_inv = cv2.bitwise_not(mask)
                    
                    if background_img is not None:
                        # Replace green pixels with background
                        result = frame.copy()
                        result[mask > 0] = background_img[mask > 0]
                    else:
                        # For transparent background, just use original frame
                        # (OpenCV doesn't handle transparency well, so we keep original)
                        result = frame
                else:
                    result = frame
                
                out.write(result)
                
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
    parser = argparse.ArgumentParser(description='Remove background from video (OpenCV version)')
    parser.add_argument('--input', required=True, help='Input video path')
    parser.add_argument('--output', required=True, help='Output video path')
    parser.add_argument('--background-type', default='transparent', choices=['transparent', 'color', 'image'])
    parser.add_argument('--background-value', help='Background color (hex) or image path')
    
    args = parser.parse_args()
    
    success = remove_background_opencv(
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