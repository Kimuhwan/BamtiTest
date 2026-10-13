from http.server import BaseHTTPRequestHandler
import json
import os
import base64
import hashlib
import google.generativeai as genai

genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))

# [간이 캐싱] 메모리에 결과 저장 (서버가 재시작되면 초기화되지만, 단기 트래픽 방어에 탁월)
# 실제 프로덕션에서는 Redis 등을 쓰지만, 무료/간편 구현을 위해 In-Memory 방식 채택
RESULT_CACHE = {}
MAX_BODY_BYTES = 3 * 1024 * 1024
MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_CACHE_ENTRIES = 100

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', '0'))
            if content_length <= 0 or content_length > MAX_BODY_BYTES:
                self.send_response(413 if content_length > MAX_BODY_BYTES else 400)
                self.end_headers()
                return
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            
            if not isinstance(body, dict):
                raise ValueError("Invalid request")
            # Base64 이미지 데이터
            image_data = body.get('image', '')
            if not isinstance(image_data, str) or not image_data:
                raise ValueError("Invalid image")
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # 1. 이미지 해시 생성 (캐싱 키)
            # 이미지 데이터 자체를 해시하여 고유값 생성 (같은 사진 = 같은 해시)
            image_hash = hashlib.md5(image_data.encode('utf-8')).hexdigest()

            # 2. 캐시 확인 (있으면 바로 리턴 -> 비용 0, 시간 0)
            if image_hash in RESULT_CACHE:
                print(f"Cache Hit! {image_hash}")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(RESULT_CACHE[image_hash]).encode('utf-8'))
                return

            # --- 캐시에 없으면 아래 AI 분석 실행 ---
            
            image_bytes = base64.b64decode(image_data, validate=True)
            if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
                raise ValueError("Invalid image size")
            model = genai.GenerativeModel('gemini-1.5-flash')

            prompt = """
            너는 한국의 트렌디한 거리(성수, 홍대)를 잘 아는 냉철한 패션 비평가야.
            이 사진 속 인물의 패션을 분석해서 JSON 형식으로 답해줘.
            
            판단 기준:
            - '느좋'(Neujo): 핏이 좋고, 힙하며, 색 조합이 센스 있음.
            - '밤티'(Bamti): 촌스럽거나, 핏이 어정쩡하거나, 너무 무난해서 매력이 없음.
            
            반드시 아래 JSON 형식으로만 출력해:
            {
                "score": 0~100 사이 정수 (높을수록 좋음),
                "verdict": "느좋!" 또는 "밤티..",
                "title": "한 줄 요약 (예: 성수동 힙스터 호소인)",
                "comment": "친구에게 말하듯 반말(존대X)로 구체적인 피드백 (50자 이내)",
                "stats": {
                    "trendy": 1~10,
                    "color": 1~10,
                    "fit": 1~10
                },
                "advice": "개선점이나 칭찬 한 줄"
            }
            """

            response = model.generate_content([
                {'mime_type': 'image/jpeg', 'data': image_bytes},
                prompt
            ])

            response_text = response.text.replace("```json", "").replace("```", "").strip()
            result_json = json.loads(response_text)

            # 3. 결과 캐싱 (다음 요청을 위해 저장)
            if len(RESULT_CACHE) >= MAX_CACHE_ENTRIES:
                RESULT_CACHE.pop(next(iter(RESULT_CACHE)))
            RESULT_CACHE[image_hash] = result_json

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result_json).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "AI analysis failed"}).encode('utf-8'))
