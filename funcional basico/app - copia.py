import requests
import sys
import os
import json

BASE_URL = "https://dataportal.eplan.com/api"

def get_pat():
    pat = os.environ.get('EPLAN_PAT')
    if not pat:
        pat = input("Por favor, ingrese su Personal Access Token (PAT): ")
    return pat

def get_part_info(part_id, pat):
    headers = {"Authorization": f"Bearer PAT:{pat}"}
    url = f"{BASE_URL}/parts/{part_id}"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def get_macro_info(macro_id, pat):
    headers = {"Authorization": f"Bearer PAT:{pat}"}
    url = f"{BASE_URL}/macros/{macro_id}"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def get_first_macro_variant_id(macro_info):
    macro_variants = macro_info['data']['relationships']['macro_variants']['data']
    if macro_variants:
        return macro_variants[0]['id']
    return None

def download_file(url, filename, pat):
    headers = {"Authorization": f"Bearer PAT:{pat}"}
    response = requests.get(url, headers=headers)
    try:
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Error: {e}")
        print(f"URL: {url}")
        print(f"Response status code: {response.status_code}")
        print(f"Response headers: {response.headers}")
        print(f"Response content: {response.text}")
        raise
    with open(filename, 'wb') as f:
        f.write(response.content)
    print(f"Archivo guardado como: {filename}")

def download_part(part_id, pat, file_type):
    print(f"Iniciando descarga de la parte con ID: {part_id}")
    
    try:
        part_info = get_part_info(part_id, pat)
        
        if file_type == 'dxf':
            url = f"{BASE_URL}/download/dxf_data/part/{part_id}"
            filename = f"part_{part_id}.zip"
            download_file(url, filename, pat)
        elif file_type == '3d':
            macro_id = part_info['data']['relationships']['graphic_macro']['data']['id']
            macro_info = get_macro_info(macro_id, pat)
            macro_variant_id = get_first_macro_variant_id(macro_info)
            if macro_variant_id:
                url = f"{BASE_URL}/download/e3d_data/{macro_variant_id}"
                filename = f"macro_{macro_variant_id}.e3d"
                download_file(url, filename, pat)
            else:
                print("No se encontró ninguna variante de macro para esta parte.")
                return False
        
        print(f"Parte {part_id} descargada exitosamente.")
    
    except requests.RequestException as e:
        if e.response.status_code == 401:
            print("Error: No autorizado. Por favor, verifique su Personal Access Token (PAT).")
        elif e.response.status_code == 404:
            print(f"Error: La parte con ID {part_id} no fue encontrada.")
        else:
            print(f"Error: {str(e)}")
        return False
    return True

if __name__ == '__main__':
    pat = get_pat()
    while True:
        part_id = input("Por favor, ingrese el ID de la parte que desea descargar (o 'q' para salir): ")
        if part_id.lower() == 'q':
            print("Saliendo del programa...")
            break
        
        file_type = input("¿Desea descargar el archivo DXF o la macro 3D? (dxf/3d): ").lower()
        while file_type not in ['dxf', '3d']:
            file_type = input("Por favor, ingrese 'dxf' o '3d': ").lower()
        
        success = download_part(part_id, pat, file_type)
        if not success:
            retry = input("¿Desea intentar con un nuevo PAT? (s/n): ")
            if retry.lower() == 's':
                pat = get_pat()
            else:
                print("Saliendo del programa...")
                break
        print("\n")