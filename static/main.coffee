API_ROOT = '/api'

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
        $.getJSON(API_ROOT + '/bing')

$( ->
    register_click_events()
    console.log "Hello World!"
)
