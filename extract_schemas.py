import json
import sys

def extract():
    try:
        with open('g:/Projects/neco-apcic-manager/neco-apcic-manager-FE/openapi.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        schemas = data.get('components', {}).get('schemas', {})
        targets = [
            'SSCEExtCustodianCreate', 'SSCEExtCustodianResponse',
            'SSCEExtMarkingVenueCreate', 'SSCEExtMarkingVenueResponse',
            'BECEMarkingVenueCreate', 'BECEMarkingVenueResponse'
        ]
        
        result = {t: schemas.get(t, 'NOT FOUND') for t in targets}
        with open('extracted_schemas.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print('Extracted to extracted_schemas.json')
    except Exception as e:
        print(f'Error: {str(e)}')

if __name__ == '__main__':
    extract()
