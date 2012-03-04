(function() {
  var API_ROOT, AlarmModel, AlarmView, MusicPlayer, RdioMusicPlayer, auth_check, client_id, get_full_state, get_music_player, implement_state_change, model_map, music_player, poll_loop, prepare, push_state_change, register_click_events;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  };
  API_ROOT = '/api';
  client_id = Math.ceil(Math.random() * 10000000000000000);
  console.log('using client id', client_id);
  MusicPlayer = (function() {
    function MusicPlayer() {}
    MusicPlayer.prototype.play = function(foreign_id) {};
    return MusicPlayer;
  })();
  RdioMusicPlayer = (function() {
    __extends(RdioMusicPlayer, MusicPlayer);
    function RdioMusicPlayer() {
      $.getJSON(API_ROOT + '/get_rdio_playback_token', function(res) {
        var token;
        token = res.result;
        console.log("got token:", token);
        return $('#rdio-player').rdio(token);
      });
    }
    RdioMusicPlayer.prototype.play = function(foreign_id) {
      console.log('waiting to play');
      return $('#rdio-player').bind('ready.rdio', function(event, userInfo) {
        return $('#rdio-player').rdio().play(foreign_id.split(":")[2]);
      });
    };
    return RdioMusicPlayer;
  })();
  music_player = null;
  get_music_player = function() {
    if (!music_player) {
      music_player = new RdioMusicPlayer();
    }
    return music_player;
  };
  auth_check = function(res) {
    if (res.user_not_found) {
      return window.location.href = '/login';
    }
  };
  poll_loop = function() {
    var full_state;
    full_state = JSON.stringify(get_full_state());
    console.log('polling with', full_state);
    return $.ajax(API_ROOT + '/poll', {
      type: 'POST',
      data: full_state,
      success: function(res) {
        console.log('pulling iwth', res);
        implement_state_change($.parseJSON(res));
        return setTimeout(function() {
          return poll_loop();
        }, 1000);
      },
      error: function(res) {
        console.log("error, waiting 1 second");
        return setTimeout(function() {
          return poll_loop();
        }, 1000);
      },
      timeout: 60000
    });
  };
  register_click_events = function() {
    $('button#get-songs').click(function() {
      return $.getJSON(API_ROOT + '/get_songs', function(res) {
        console.log('got songs:', res);
        auth_check(res);
        return get_music_player().play(res[0]);
      });
    });
    return $('button#bing').click(function() {
      return $.ajax(API_ROOT + '/notify', {
        type: 'POST',
        data: String(Math.ceil(Math.random() * 10))
      });
    });
  };
  AlarmView = (function() {
    function AlarmView() {
      AlarmView.__super__.constructor.apply(this, arguments);
    }
    __extends(AlarmView, Backbone.View);
    AlarmView.prototype.initialize = function(options) {
      this.setElement($(options.selector));
      this.render();
      return this;
    };
    AlarmView.prototype.events = {
      'change input': 'alarm_time_changed'
    };
    AlarmView.prototype.alarm_time_changed = function() {
      var newval;
      newval = this.$('input').val();
      return this.model.set('time', newval);
    };
    AlarmView.prototype.render = function() {
      return this.$el.append("!");
    };
    return AlarmView;
  })();
  AlarmModel = (function() {
    function AlarmModel() {
      AlarmModel.__super__.constructor.apply(this, arguments);
    }
    __extends(AlarmModel, Backbone.Model);
    AlarmModel.prototype.defaults = {
      time: null
    };
    return AlarmModel;
  })();
  model_map = {};
  prepare = function() {
    var key, model;
    model_map.sunday_alarm = new AlarmModel();
    model_map.weekday_alarm = new AlarmModel();
    model_map.satuday_alarm = new AlarmModel();
    for (key in model_map) {
      model = model_map[key];
      model.on('change', push_state_change);
    }
    new AlarmView({
      selector: '#sunday-alarm',
      model: model_map.sunday_alarm
    });
    new AlarmView({
      selector: '#weekday-alarm',
      model: model_map.weekday_alarm
    });
    return new AlarmView({
      selector: '#saturday-alarm',
      model: model_map.saturday_alarm
    });
  };
  get_full_state = function() {
    var full_state, key, model;
    full_state = {};
    for (key in model_map) {
      model = model_map[key];
      full_state[key] = model.toJSON();
    }
    return full_state;
  };
  push_state_change = function() {
    var full_state;
    full_state = get_full_state();
    return $.ajax(API_ROOT + '/notify', {
      type: 'POST',
      data: JSON.stringify(full_state)
    });
  };
  implement_state_change = function(full_state) {
    var attributes, key, _results;
    console.log('pulling:', full_state);
    _results = [];
    for (key in full_state) {
      attributes = full_state[key];
      _results.push(model_map[key].set(attributes));
    }
    return _results;
  };
  $(function() {
    prepare();
    register_click_events();
    console.log("Hello World!");
    return poll_loop();
  });
}).call(this);
