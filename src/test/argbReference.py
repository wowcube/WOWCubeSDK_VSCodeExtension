"""Run the reference codec's actual RLE row function without requiring NumPy."""
import ast
import json
import importlib.util
from pathlib import Path
import sys

request = json.load(sys.stdin)
if isinstance(request, dict):
    import numpy as np
    spec = importlib.util.spec_from_file_location('argb6666_reference', sys.argv[1])
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    rgba = np.array(request['rgba'], dtype=np.uint8).reshape(request['height'], request['width'], 4)
    print(json.dumps({'texels': reference.pack_texels(rgba, request['dither']).tobytes().hex(),
                      'body': reference.encode(rgba, request['dither']).hex()}))
    sys.exit(0)

module = ast.parse(Path(sys.argv[1]).read_text())
function = next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == 'rle_row')
namespace = {'MAX_RUN': 129, 'MAX_LITERAL': 128, 'OCT_RAW565_RUN': 128}
exec(compile(ast.Module(body=[function], type_ignores=[]), '<reference rle_row>', 'exec'), namespace)

class Comparison:
    def __init__(self, value):
        self.value = value
    def all(self):
        return self.value

class Texel(bytes):
    def __eq__(self, other):
        return Comparison(bytes.__eq__(self, other))
    def tobytes(self):
        return bytes(self)

rows = request
print(json.dumps([namespace['rle_row']([Texel(bytes.fromhex(texel)) for texel in row]).hex() for row in rows]))
