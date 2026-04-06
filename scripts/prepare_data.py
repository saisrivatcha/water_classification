import os

# Mapping of original directory names to target class names
mapping = {
    "Fresh water": "clean",
    "Polluted water": "polluted",
    "River water": "river",
    "lake water": "lake",
    "Fish pond": "fish pond",
    "industrial": "industrial wastewater",
    "muddy water": "muddy",
    "Sea water": "sea water"
}

base_dir = "."

for old_name, new_name in mapping.items():
    old_path = os.path.join(base_dir, old_name)
    new_path = os.path.join(base_dir, new_name)

    if os.path.exists(old_path):
        print(f"Renaming '{old_name}' to '{new_name}'...")
        # Check if new path already exists to avoid errors
        if not os.path.exists(new_path):
            os.rename(old_path, new_path)
            print("Done.")
        else:
            print(f"Warning: Target '{new_name}' already exists.")
    else:
        # It's possible it was already renamed, or doesn't exist
        print(f"Folder '{old_name}' not found. Might be renamed already.")

print("Finished renaming mapping.")
