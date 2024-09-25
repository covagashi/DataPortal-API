import requests
import sys
import os
import json

BASE_URL = "https://dataportal.eplan.com/api"

def get_pat():
    pat = os.environ.get('EPLAN_PAT')
    if not pat:
        pat = "D2FE459B3F31C0296C76344D6BAB4A1AB63329DC74817BE4F353F2E1C08B69A5-1"
    return pat

def make_api_request(url, pat, method='GET', data=None):
    headers = {"Authorization": f"Bearer PAT:{pat}"}
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        else:
            raise ValueError(f"Método HTTP no soportado: {method}")

        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error en la solicitud a {url}:")
        print(f"Código de estado: {e.response.status_code}")
        print(f"Mensaje de error: {e.response.text}")
        raise

def get_part_info(part_id, pat):
    url = f"{BASE_URL}/parts/{part_id}"
    return make_api_request(url, pat)

def get_macro_info(macro_id, pat):
    url = f"{BASE_URL}/macros/{macro_id}"
    return make_api_request(url, pat)

def is_3d_macro(macro_info):
    # Verificar si el nombre de la macro termina en '3D'
    if macro_info['data']['attributes']['name'].lower().endswith('3d'):
        return True
    
    # Verificar si el ID del preview termina en '3D.ema'
    preview_id = macro_info['data']['relationships']['preview']['data']['id']
    if preview_id.lower().endswith('3d.ema'):
        return True
    
    return False

def download_file(url, filename, pat):
    headers = {"Authorization": f"Bearer PAT:{pat}"}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"Archivo guardado como: {filename}")
        return True
    except requests.RequestException as e:
        print(f"Error al descargar {filename}:")
        print(f"Código de estado: {e.response.status_code}")
        print(f"Mensaje de error: {e.response.text}")
        return False

def download_3d_macros(part_id, pat):
    print(f"Iniciando descarga de macros 3D para la parte con ID: {part_id}")
    
    try:
        part_info = get_part_info(part_id, pat)
        if 'graphic_macro' not in part_info['data']['relationships']:
            print("Esta parte no tiene una macro gráfica asociada.")
            return False
        
        macro_id = part_info['data']['relationships']['graphic_macro']['data']['id']
        macro_info = get_macro_info(macro_id, pat)

        print(f"Información de la macro: {json.dumps(macro_info, indent=2)}")

        if not is_3d_macro(macro_info):
            print("Este part number no tiene ninguna macro 3D relacionada.")
            return False
        
        print("Se ha encontrado una macro 3D. Intentando descargar variantes...")
        
        success = False
        for variant in macro_info['data']['relationships']['macro_variants']['data']:
            variant_id = variant['id']
            url = f"{BASE_URL}/download/e3d_data/{variant_id}"
            filename = f"macro_{variant_id}.e3d"
            if download_file(url, filename, pat):
                success = True
                print(f"Se ha descargado la variante 3D: {filename}")
        
        if not success:
            print("No se pudo descargar ninguna variante 3D válida.")
        else:
            print("Descarga de macros 3D completada.")
        
        return success
    
    except requests.RequestException as e:
        print(f"Error: {str(e)}")
        return False

def download_part(part_id, pat, file_type):
    if file_type == 'dxf':
        url = f"{BASE_URL}/download/dxf_data/part/{part_id}"
        filename = f"part_{part_id}.zip"
        return download_file(url, filename, pat)
    elif file_type == '3d':
        return download_3d_macros(part_id, pat)

if __name__ == '__main__':
    pat = get_pat()
    while True:
        part_id = input("Por favor, ingrese el ID de la parte que desea descargar (o 'q' para salir): ")
        if not part_id:
            print("El ID de la parte no puede estar vacío.")
            continue
        if part_id.lower() == 'q':
            print("Saliendo del programa...")
            break
        
        file_type = input("¿Desea descargar el archivo DXF o la macro 3D? (dxf/3d): ").lower()
        while file_type not in ['dxf', '3d']:
            file_type = input("Por favor, ingrese 'dxf' o '3d': ").lower()
        
        try:
            success = download_part(part_id, pat, file_type)
            if not success:
                retry = input("¿Desea intentar con un nuevo PAT? (s/n): ")
                if retry.lower() == 's':
                    pat = get_pat()
                else:
                    print("Saliendo del programa...")
                    break
        except requests.RequestException as e:
            print(f"Error en la solicitud: {e}")
            retry = input("¿Desea intentar de nuevo? (s/n): ")
            if retry.lower() != 's':
                print("Saliendo del programa...")
                break
        print("\n")