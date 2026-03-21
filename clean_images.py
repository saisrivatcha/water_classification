import os
from PIL import Image

def clean_dataset(directory):
    removed_count = 0
    total_count = 0
    for root, _, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
                filepath = os.path.join(root, file)
                total_count += 1
                try:
                    with Image.open(filepath) as img:
                        img.verify() # Verify that it is, in fact, an image
                except Exception as e:
                    print(f"Removing corrupted image: {filepath} - Error: {e}")
                    try:
                        abs_path = os.path.abspath(filepath)
                        long_path = "\\\\?\\" + abs_path
                        os.remove(long_path)
                        removed_count += 1
                    except Exception as rm_e:
                        print(f"Failed to remove {filepath}: {rm_e}")
    
    print(f"Finished scanning {total_count} images.")
    print(f"Removed {removed_count} corrupted images.")

if __name__ == '__main__':
    dataset_dir = 'dataset'
    clean_dataset(dataset_dir)
