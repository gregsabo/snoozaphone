API_ROOT = '/api'

auth_check = (res) ->
    if res.user_not_found
        window.location.href = '/login'

register_click_events = ->
    $('button#get-songs').click ->
        $.getJSON( API_ROOT + '/get_songs', (res)->
            auth_check(res)
            console.log res
        )
$( ->
    register_click_events()
    console.log "Hello World!"
)
