(function() {
  var API_ROOT, AlarmModel, AlarmView, MusicPlayer, RdioMusicPlayer, StateManager, auth_check, client_id, get_music_player, music_player, register_click_events;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  API_ROOT = '/api';
  client_id = Math.ceil(Math.random() * 10000000000000000);
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
      this.render = __bind(this.render, this);;      AlarmView.__super__.constructor.apply(this, arguments);
    }
    __extends(AlarmView, Backbone.View);
    AlarmView.prototype.initialize = function(options) {
      this.setElement($(options.selector));
      this.model = options.model;
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
      var time_string;
      console.log('rendering!', this.model);
      time_string = this.model.get('time');
      if (time_string && time_string.indexOf(':') === -1) {
        time_string = time_string.slice(0, -2) + ':' + time_string.slice(-2);
      }
      return this.$('input').val(time_string);
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
    AlarmModel.prototype.validate = function(attributes) {
      var minutes, num, num_string;
      if (attributes != null ? attributes.time : void 0) {
        num_string = attributes.time.replace(/\:/g, "");
        num = parseInt(num_string);
        console.log('validating', num);
        if (num < 100 || num > 1259) {
          return false;
        }
        minutes = num - (Math.floor(num / 100) * 100);
        console.log('checking min', minutes);
        if (minutes > 59) {
          return false;
        }
      }
      return null;
    };
    return AlarmModel;
  })();
  StateManager = (function() {
    function StateManager() {
      this.push_state_change = __bind(this.push_state_change, this);;      this.last_state = null;
      this.model_map = {};
      this.hook_up('sunday_alarm', AlarmModel, AlarmView);
      this.hook_up('weekday_alarm', AlarmModel, AlarmView);
      this.hook_up('saturday_alarm', AlarmModel, AlarmView);
    }
    StateManager.prototype.hook_up = function(key, model_class, view_class) {
      var model, view;
      model = new model_class();
      view = new view_class({
        selector: '#' + key,
        model: model
      });
      model.on('change', this.push_state_change);
      model.on('change', view.render);
      return this.model_map[key] = model;
    };
    StateManager.prototype.get_full_state = function() {
      var full_state, key, model, _ref;
      full_state = {};
      _ref = this.model_map;
      for (key in _ref) {
        model = _ref[key];
        full_state[key] = model.toJSON();
      }
      return full_state;
    };
    StateManager.prototype.push_state_change = function() {
      var full_state;
      full_state = this.get_full_state();
      return $.ajax(API_ROOT + '/notify', {
        type: 'POST',
        data: JSON.stringify(full_state)
      });
    };
    StateManager.prototype.implement_state_change = function(full_state) {
      var attributes, key, _results;
      console.log('pulling:', full_state);
      _results = [];
      for (key in full_state) {
        attributes = full_state[key];
        _results.push(this.model_map[key].set(attributes));
      }
      return _results;
    };
    StateManager.prototype.poll_loop = function() {
      var full_state;
      full_state = JSON.stringify(this.get_full_state());
      console.log('polling with', full_state);
      return $.ajax(API_ROOT + '/poll', {
        type: 'POST',
        data: full_state,
        success: __bind(function(res) {
          console.log('pulling with', res);
          if (res !== this.last_state) {
            this.implement_state_change($.parseJSON(res));
            this.last_state = res;
          }
          return setTimeout(__bind(function() {
            return this.poll_loop();
          }, this), 1000);
        }, this),
        error: __bind(function(res) {
          console.log("error, waiting 1 second");
          return setTimeout(__bind(function() {
            return this.poll_loop();
          }, this), 1000);
        }, this),
        timeout: 60000
      });
    };
    return StateManager;
  })();
  $(function() {
    var paper, state_manager;
    state_manager = new StateManager();
    state_manager.poll_loop();
    return paper = Raphael("backdrop", window.width, window.height);
  });
}).call(this);
