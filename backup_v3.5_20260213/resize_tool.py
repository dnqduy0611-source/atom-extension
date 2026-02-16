from PIL import Image
import os

files = [
    "C:/Users/ADMIN/.gemini/antigravity/brain/c9222113-fcbf-4c90-85d0-b7babd401db6/uploaded_image_0_1768539941400.png",
    "C:/Users/ADMIN/.gemini/antigravity/brain/c9222113-fcbf-4c90-85d0-b7babd401db6/uploaded_image_1_1768539941400.png",
    "C:/Users/ADMIN/.gemini/antigravity/brain/c9222113-fcbf-4c90-85d0-b7babd401db6/uploaded_image_2_1768539941400.png",
    "C:/Users/ADMIN/.gemini/antigravity/brain/c9222113-fcbf-4c90-85d0-b7babd401db6/uploaded_image_3_1768539941400.png"
]

target_size = (1280, 800)
# Dark background #050505 to match extension
bg_color = (5, 5, 5) 

print("Starting resize process...")

for i, fpath in enumerate(files):
    try:
        if not os.path.exists(fpath):
            print(f"File not found: {fpath}")
            continue
            
        print(f"Processing {fpath}...")
        img = Image.open(fpath)
        
        # Calculate aspect ratios
        target_ratio = target_size[0] / target_size[1]
        img_ratio = img.width / img.height
        
        new_size = None
        if img_ratio > target_ratio:
            # Image is wider -> fit to width
            new_width = target_size[0]
            new_height = int(new_width / img_ratio)
            new_size = (new_width, new_height)
        else:
            # Image is taller or equal -> fit to height
            new_height = target_size[1]
            new_width = int(new_height * img_ratio)
            new_size = (new_width, new_height)
            
        resized_img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Create background
        new_img = Image.new("RGB", target_size, bg_color)
        
        # Center position
        paste_x = (target_size[0] - new_size[0]) // 2
        paste_y = (target_size[1] - new_size[1]) // 2
        
        new_img.paste(resized_img, (paste_x, paste_y))
        
        out_path = fpath.replace(".png", "_resized.png")
        new_img.save(out_path)
        print(f"Saved: {out_path}")
        
    except Exception as e:
        print(f"Error processing {fpath}: {e}")

print("Done.")
