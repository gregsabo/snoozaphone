API_ROOT = '/api'
client_id = Math.ceil(Math.random() * 10000000000000000)
console.log 'using client id', client_id

class MusicPlayer
    play: (foreign_id) ->
        return

class RdioMusicPlayer extends MusicPlayer
    constructor: ->
        $.getJSON(API_ROOT + '/get_rdio_playback_token', (res) ->
            token = res.result
            console.log "got token:", token
            $('#rdio-player').rdio(token)
        )

    play: (foreign_id) ->
        console.log 'waiting to play'
        $('#rdio-player').bind 'ready.rdio', (event, userInfo) ->
            $('#rdio-player').rdio().play(foreign_id.split(":")[2])

music_player = null
get_music_player = ->
    if not music_player
        music_player = new RdioMusicPlayer()
    return music_player

auth_check = (res) ->
    if res.user_not_found
        window.location.href = '/login'

poll_loop = ->
    full_state = JSON.stringify(get_full_state())
    console.log 'polling with', full_state
    $.ajax(API_ROOT + '/poll',
        type: 'POST'
        data: full_state
        success: (res) ->
            console.log 'pulling iwth', res
            implement_state_change($.parseJSON(res))
            setTimeout(->
                poll_loop()
            , 1000)
        error: (res) ->
            console.log "error, waiting 1 second"
            setTimeout(->
                poll_loop()
            , 1000)
        timeout: 60000
    )

register_click_events = ->
    $('button#get-songs').click ->
        $.getJSON(API_ROOT + '/get_songs', (res) ->
            console.log 'got songs:', res
            auth_check(res)
            get_music_player().play(res[0])
        )
    $('button#bing').click ->
        $.ajax(API_ROOT + '/notify',
            type: 'POST',
            data: String(Math.ceil(Math.random() * 10)),
        )


class AlarmView extends Backbone.View
    initialize: (options) ->
        @setElement($(options.selector))
        @render()
        return this

    events:
        'change input': 'alarm_time_changed'

    alarm_time_changed: ->
        newval = @$('input').val()
        @model.set('time', newval)

    render: ->
        @$el.append("!")


class AlarmModel extends Backbone.Model
    defaults:
        time: null


model_map = {}
prepare = ->
    model_map.sunday_alarm = new AlarmModel()
    model_map.weekday_alarm = new AlarmModel()
    model_map.satuday_alarm = new AlarmModel()

    for key, model of model_map
        model.on('change', push_state_change)

    new AlarmView({selector:'#sunday-alarm', model:model_map.sunday_alarm})
    new AlarmView({selector:'#weekday-alarm', model:model_map.weekday_alarm})
    new AlarmView({selector:'#saturday-alarm', model:model_map.saturday_alarm})

get_full_state = () ->
    full_state = {}
    for key, model of model_map
        full_state[key] = model.toJSON()
    return full_state

push_state_change = ->
    full_state = get_full_state()
    $.ajax(API_ROOT + '/notify',
        type: 'POST'
        data: JSON.stringify(full_state)
    )

implement_state_change = (full_state) ->
    console.log 'pulling:', full_state
    for key, attributes of full_state
        model_map[key].set(attributes)


$( ->
    prepare()
    register_click_events()
    console.log "Hello World!"
    poll_loop()
)
