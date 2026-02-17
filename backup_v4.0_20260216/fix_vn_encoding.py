#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix double-encoded UTF-8 in Vietnamese messages.json"""

import json
import re

def fix_encoding(filepath):
    """Fix double-encoded UTF-8 in a JSON file using ftfy-like approach."""
    with open(filepath, 'rb') as f:
        content_bytes = f.read()
    
    # Decode as UTF-8
    content = content_bytes.decode('utf-8')
    original = content
    
    # Check if it looks like double-encoded UTF-8
    # Common markers: capital A with tilde (U+00C3) followed by other characters
    if '\u00c3' not in content and '\u00c4' not in content:
        print("File appears to be correctly encoded already.")
        return False
    
    # Fix double-encoding by encoding as Latin-1 then decoding as UTF-8
    # This works because UTF-8 bytes were misinterpreted as Latin-1
    try:
        # Split by lines to handle any problematic characters
        lines = content.split('\n')
        fixed_lines = []
        
        for line in lines:
            try:
                # Try to fix the double encoding
                fixed = line.encode('latin-1', errors='replace').decode('utf-8', errors='replace')
                fixed_lines.append(fixed)
            except:
                fixed_lines.append(line)
        
        content = '\n'.join(fixed_lines)
    except Exception as e:
        print(f"Method 1 failed: {e}, trying method 2...")
        
        # Method 2: Manual replacement of common patterns
        replacements = {
            # Lowercase a
            '\u00c3\u00a1': '\u00e1',  # á
            '\u00c3\u00a0': '\u00e0',  # à
            '\u00c3\u00a3': '\u00e3',  # ã
            '\u00c3\u00a2': '\u00e2',  # â
            # Lowercase e
            '\u00c3\u00a9': '\u00e9',  # é
            '\u00c3\u00a8': '\u00e8',  # è
            '\u00c3\u00aa': '\u00ea',  # ê
            # Lowercase i
            '\u00c3\u00ad': '\u00ed',  # í
            '\u00c3\u00ac': '\u00ec',  # ì
            # Lowercase o
            '\u00c3\u00b3': '\u00f3',  # ó
            '\u00c3\u00b2': '\u00f2',  # ò
            '\u00c3\u00b5': '\u00f5',  # õ
            '\u00c3\u00b4': '\u00f4',  # ô
            # Lowercase u
            '\u00c3\u00ba': '\u00fa',  # ú
            '\u00c3\u00b9': '\u00f9',  # ù
            # Lowercase y
            '\u00c3\u00bd': '\u00fd',  # ý
            # d with stroke
            '\u00c4\u0091': '\u0111',  # đ
            '\u00c4\u0090': '\u0110',  # Đ
        }
        
        for old, new in replacements.items():
            content = content.replace(old, new)
    
    if content == original:
        print("No changes made - encoding fix didn't work.")
        return False
    
    # Validate JSON
    try:
        json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Warning: Fixed content may not be valid JSON: {e}")
        print("Saving anyway...")
    
    # Write back with UTF-8 encoding and BOM
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("File fixed successfully!")
    print("Sample of fixed content:")
    
    # Find a sample with Vietnamese text
    for line in content.split('\n')[5:15]:
        if 'message' in line:
            print(line.strip())
    
    return True

if __name__ == '__main__':
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else r'd:\Amo\ATOM_Extension_V2.7.1\_locales\vi\messages.json'
    print(f"Fixing encoding in: {filepath}")
    success = fix_encoding(filepath)
    print("Done!" if success else "No changes needed.")
