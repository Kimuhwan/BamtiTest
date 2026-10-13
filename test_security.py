import ast,base64,io,json,pathlib,unittest
from unittest.mock import Mock
ROOT=pathlib.Path(__file__).parent
class SecurityTests(unittest.TestCase):

    def test_bamti_rejects_size_and_hides_errors(self):
        source = (ROOT / 'api/analyze.py').read_text()
        tree = ast.parse(source)
        cls = next((n for n in tree.body if isinstance(n, ast.ClassDef)))
        ns = {'BaseHTTPRequestHandler': object, 'MAX_BODY_BYTES': 32, 'MAX_IMAGE_BYTES': 16, 'MAX_CACHE_ENTRIES': 2, 'RESULT_CACHE': {}, 'json': json, 'base64': base64}
        exec(compile(ast.Module(body=[cls], type_ignores=[]), 'analyze', 'exec'), ns)
        for length, data, expected in [('100000000', b'', 413), ('-1', b'', 400), ('20', b'[]', 500), ('20', b'{"image":123}', 500)]:
            h = ns['handler']()
            h.headers = {'Content-Length': length}
            h.rfile = io.BytesIO(data)
            h.wfile = io.BytesIO()
            h.send_response = Mock()
            h.end_headers = Mock()
            h.do_POST()
            h.send_response.assert_called_once_with(expected)
            if expected == 500:
                self.assertEqual(json.loads(h.wfile.getvalue()), {'error': 'AI analysis failed'})
if __name__=='__main__':unittest.main()
