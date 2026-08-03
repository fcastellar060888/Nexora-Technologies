# Cierre forense — AUD-F021

## Hallazgo

**AUD-F021 — Passport Builder:** los plugins recibían copias congeladas únicamente en la primera capa. Un plugin podía modificar objetos o arreglos anidados de `state` y `context`, contaminando al siguiente plugin y al estado del llamador.

## Corrección

- `state` y `context` se copian mediante `structuredClone()` antes de ejecutar plugins.
- La copia se congela recursivamente.
- Todos los plugins observan la misma evidencia aislada e inmutable.
- Datos no clonables se rechazan antes de ejecutar cualquier plugin.
- El estado y contexto originales nunca se exponen ni se modifican.

## Evidencia

- Aislamiento profundo del builder: `7cee61cb4358d1df399f4f86d7aac6e26997f4ba`
- Pruebas hostiles y de no clonabilidad: `843ccaa48004251efbffac68e73680dc3d6997b8`

## Quality

- `#777`: **success**.

## Reauditoría independiente

Se verificó que un plugin hostil no puede modificar propiedades anidadas, arreglos de permisos ni evidencia compartida, y que un plugin posterior recibe los valores originales.

## Dictamen

`AUD-F021` queda **cerrado y certificado**.
