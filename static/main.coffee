API_ROOT = '/api'
client_id = Math.ceil(Math.random() * 10000000000000000)

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
        @model = options.model
        @render()
        return this

    events:
        'change input': 'alarm_time_changed'

    alarm_time_changed: ->
        newval = @$('input').val()
        @model.set('time', newval)

    render: =>
        console.log 'rendering!', @model
        time_string = @model.get('time')
        if time_string and time_string.indexOf(':') is -1
            time_string = time_string.slice(0, -2) + ':' + time_string.slice(-2)
        @$('input').val(time_string)


class AlarmModel extends Backbone.Model
    defaults:
        time: null

    validate: (attributes) ->
        if attributes?.time
            num_string = attributes.time.replace(/\:/g,"")
            num = parseInt(num_string)
            console.log 'validating', num
            if num < 100 or num > 1259
                return false
            minutes = num - (Math.floor(num/100) * 100)
            console.log 'checking min', minutes
            if minutes > 59
                return false
        return null


class StateManager
    constructor: ->
        @last_state = null
        @model_map = {}
        @hook_up('sunday_alarm', AlarmModel, AlarmView)
        @hook_up('weekday_alarm', AlarmModel, AlarmView)
        @hook_up('saturday_alarm', AlarmModel, AlarmView)

    hook_up: (key, model_class, view_class) ->
        model = new model_class()
        view = new view_class({selector:'#'+key, model:model})
        model.on('change', @push_state_change)
        model.on('change', view.render)
        @model_map[key] = model

    get_full_state: ->
        full_state = {}
        for key, model of @model_map
            full_state[key] = model.toJSON()
        return full_state

    push_state_change: =>
        full_state = @get_full_state()
        $.ajax(API_ROOT + '/notify',
            type: 'POST'
            data: JSON.stringify(full_state)
        )

    implement_state_change: (full_state) ->
        console.log 'pulling:', full_state
        for key, attributes of full_state
            @model_map[key].set(attributes)

    poll_loop: ->
        full_state = JSON.stringify(@get_full_state())
        console.log 'polling with', full_state
        $.ajax(API_ROOT + '/poll',
            type: 'POST'
            data: full_state
            success: (res) =>
                console.log 'pulling with', res
                if res isnt @last_state
                    @implement_state_change($.parseJSON(res))
                    @last_state = res
                setTimeout(=>
                    @poll_loop()
                , 1000)
            error: (res) =>
                console.log "error, waiting 1 second"
                setTimeout(=>
                    @poll_loop()
                , 1000)
            timeout: 60000
        )


$( ->
    state_manager = new StateManager()
    state_manager.poll_loop()
    paper = Raphael("backdrop", window.width, window.height)
)
