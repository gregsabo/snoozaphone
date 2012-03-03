(function() {
  var API_ROOT, auth_check, register_click_events;
  API_ROOT = '/api';
  auth_check = function(res) {
    if (res.user_not_found) {
      return window.location.href = '/login';
    }
  };
  register_click_events = function() {
    return $('button#get-songs').click(function() {
      return $.getJSON(API_ROOT + '/get_songs', function(res) {
        auth_check(res);
        return console.log(res);
      });
    });
  };
  $(function() {
    register_click_events();
    return console.log("Hello World!");
  });
}).call(this);
