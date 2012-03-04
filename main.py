import time
from collections import deque
import os
import json
from kyototycoon import KyotoTycoon
from pyechonest import playlist

import tornado.ioloop
import tornado.web
import tornado.auth

import pymc

from rdio import Rdio

mc = pymc.Client('localhost:11211')
mc.set('foo', 'bar')
assert mc.get('foo') == 'bar', 'memcached not found'

kt = KyotoTycoon()
kt.open(host='localhost', port=1978)
config_dict = json.load(open("snoozaphone.json", "r"))
rdio = Rdio((str(config_dict["RDIO_CONSUMER_KEY"]), str(config_dict["RDIO_CONSUMER_SECRET"])))

class SnoozeAuthHandler(tornado.web.RequestHandler):
    def get_current_user(self):
        user = self.get_secure_cookie("openID_user_email")
        if not user:
            self.write(json.dumps({"user_not_found":True}))
            self.finish()
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

class StaleConnection(object):
    __slots__ = ['connection', 'expiration_time', 'user_email']
    def __init__(self, connection, user_email):
        self.connection = connection
        self.expiration_time = time.time() + 60
        self.user_email = user_email

    def cleanup(self):
        user_poll_list = open_polls.get(self.user_email)
        if user_poll_list and self.connection in user_poll_list:
            user_poll_list.remove(self.connection)
        """
        if not self.connection.request.connection.stream.closed():
            self.connection.write("TERMINATED")
            self.connection.finish()
        """


open_polls = {}
stale_poll_queue = deque()
class PollHandler(SnoozeAuthHandler):
    @tornado.web.asynchronous
    @tornado.web.authenticated
    def post(self):
        user_email = self.get_current_user()
        clients_user_state = self.request.body
        existing_user_state = mc.get(user_email)
        if existing_user_state and clients_user_state != existing_user_state:
            self.write(existing_user_state)
            self.finish()
            return
        
        #otherwise, wait for state change
        if user_email not in open_polls:
            open_polls[user_email] = []
        open_polls[user_email].append(self)
        stale_connection = StaleConnection(self, user_email)
        stale_poll_queue.append(stale_connection)


class NotifyHandler(SnoozeAuthHandler):
    def post(self):
        now = time.time()
        while len(stale_poll_queue) > 0 and stale_poll_queue[0].expiration_time <= now:
            stale_poll_queue.popleft().cleanup()

        user_email = self.get_current_user()
        new_user_state = self.request.body
        existing_user_state = mc.get(user_email)
        if new_user_state == existing_user_state:
            print 'no state change, doing nothing'
            return
        mc.set(user_email, new_user_state)

        #self.write('huh')
        users_polls = open_polls.get(user_email)
        if not users_polls:
            return
        for poll in users_polls:
            #TODO: write the full state and timestamp, not just a diff
            if not poll.request.connection.stream.closed():
                poll.write(new_user_state)
                poll.finish()
        del open_polls[user_email]

class Application(tornado.web.Application):
    def __init__(self):
        handlers = [
            (r"/", MainHandler),
            (r"/login", GoogleHandler),
            (r"/api/get_songs", GetSongsHandler),
            (r"/api/get_rdio_playback_token", GetRdioPlaybackToken),
            (r"/api/notify", NotifyHandler),
            (r"/api/poll", PollHandler),
        ]

        settings = {
            "static_path"   : os.path.join(os.path.dirname(__file__), "static"),
            "template_path" : os.path.join(os.path.dirname(__file__), "templates"),
            "login_url"     : "/login",
            "cookie_secret" : "orCuCrHtSgqDcXNWFRjombEoZbw1lUJ+sgwXq3f31Qk",
            "debug"         : True,
        }

        tornado.web.Application.__init__(self, handlers, **settings)

application = Application()

if __name__ == "__main__":
    application.listen(8888)
    tornado.ioloop.IOLoop.instance().start()
