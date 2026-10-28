# 개발용 정적 서버: 브라우저가 옛 JS 모듈을 캐시해서 쓰지 않도록 no-store 헤더를 붙인다
# 사용법: python3 serve.py <폴더> <포트>
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


root, port = sys.argv[1], int(sys.argv[2])
ThreadingHTTPServer(("127.0.0.1", port), partial(NoCache, directory=root)).serve_forever()
