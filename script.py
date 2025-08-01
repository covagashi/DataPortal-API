# Este script extrae el partnumber por MOUNTINGSITE: 1, 3, 4, 5 
# para usarlo:
# python script.py parts070525.xml salida.json
import xml.etree.ElementTree as ET
import json
import sys

def extract_part_numbers(xml_file_path):
    """
    Extract part numbers from EPLAN XML where MOUNTINGSITE is 1, 3, 4, or 5
    """
    target_mountingsites = ['1', '3', '4', '5']
    extracted_parts = []
    
    try:
        # Parse XML file
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
        
        # Find all part elements
        parts = root.findall('.//part')
        
        for part in parts:
            # Get MOUNTINGSITE attribute
            mountingsite = part.get('P_ARTICLE_MOUNTINGSITE')
            
            # Check if MOUNTINGSITE matches our criteria
            if mountingsite in target_mountingsites:
                # Get part number
                part_number = part.get('P_ARTICLE_PARTNR')
                
                if part_number:
                    part_info = {
                        'part_number': part_number,
                        'mountingsite': mountingsite,
                        'description': part.get('P_ARTICLE_DESCR1', ''),
                        'manufacturer': part.get('P_ARTICLE_MANUFACTURER', ''),
                        'has_3d_macro': bool(part.get('P_ARTICLE_MACRO') and '3D' in part.get('P_ARTICLE_MACRO', ''))
                    }
                    extracted_parts.append(part_info)
        
        return extracted_parts
        
    except ET.ParseError as e:
        print(f"Error parsing XML: {e}")
        return []
    except FileNotFoundError:
        print(f"File not found: {xml_file_path}")
        return []

def create_json_output(parts, output_file=None):
    """
    Create JSON output with extracted parts
    """
    output = {
        'total_parts': len(parts),
        'mountingsite_filter': [1, 3, 4, 5],
        'parts': [part['part_number'] for part in parts],
        'detailed_parts': parts
    }
    
    json_str = json.dumps(output, indent=2, ensure_ascii=False)
    
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(json_str)
        print(f"JSON saved to: {output_file}")
    else:
        print(json_str)
    
    return output

def main():
    if len(sys.argv) < 2:
        print("Usage: python script.py <xml_file> [output_json_file]")
        sys.exit(1)
    
    xml_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"Processing XML file: {xml_file}")
    parts = extract_part_numbers(xml_file)
    
    if parts:
        print(f"Found {len(parts)} parts with MOUNTINGSITE 1, 3, 4, or 5")
        create_json_output(parts, output_file)
    else:
        print("No matching parts found")

if __name__ == "__main__":
    main()