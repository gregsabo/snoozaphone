import os
import json
from kyototycoon import KyotoTycoon
from pyechonest import playlist

import tornado.ioloop
import tornado.web
import tornado.auth

from rdio import Rdio

kt = KyotoTycoon()
kt.open(host='localhost', port=1978)
config_dict = json.load(open("snoozaphone.json", "r"))
rdio = Rdio((str(config_dict["RDIO_CONSUMER_KEY"]), str(config_dict["RDIO_CONSUMER_SECRET"])))

class SnoozeAuthHandler(tornado.web.RequestHandler):
    def get_current_user(self):
        user = self.get_secure_cookie("openID_user_email")
        if not user:
            self.write(json.dumps({"user_not_found":True}))
        else:
            return user

class GoogleHandler(tornado.web.RequestHandler, tornado.auth.GoogleMixin):
    @tornado.web.asynchronous
    def get(self):
        if self.get_argument("openid.mode", None):
            self.get_authenticated_user(self.async_callback(self._on_auth))
            return
        self.authenticate_redirect()

    def _on_auth(self, user):
        if not user:
            raise tornado.web.HTTPError(500, "Google auth failed")
        self.set_secure_cookie('openID_user_email', user['email'])
        self.redirect("/")

class MainHandler(SnoozeAuthHandler):
    def get(self):
        self.write(str(self.get_current_user()))

class GetSongsHandler(SnoozeAuthHandler):
    @tornado.web.authenticated
    def get(self):
        pl = playlist.static(type='artist-radio', artist='Madonna', buckets=['id:rdio-us-streaming'], limit=True)
        self.write(json.dumps([s.get_foreign_id('rdio-us-streaming') for s in pl]))

class GetRdioPlaybackToken(SnoozeAuthHandler):
    @tornado.web.authenticated
    def get(self):
        self.write(json.dumps(rdio.call('getPlaybackToken', {'domain':'localhost'})))

class Application(tornado.web.Application):
    def __init__(self):
        handlers = [
            (r"/", MainHandler),
            (r"/login", GoogleHandler),
            (r"/api/get_songs", GetSongsHandler),
            (r"/api/get_rdio_playback_token", GetRdioPlaybackToken),
        ]

        settings = {
            "static_path"   : os.path.join(os.path.dirname(__file__), "static"),
            "template_path" : os.path.join(os.path.dirname(__file__), "templates"),
            "login_url"     : "/login",
            "cookie_secret" : "orCuCrHtSgqDcXNWFRjombEoZbw1lUJ+sgwXq3f31Qk",
        }

        tornado.web.Application.__init__(self, handlers, **settings)

application = Application()

if __name__ == "__main__":
    application.listen(8888)
    tornado.ioloop.IOLoop.instance().start()
