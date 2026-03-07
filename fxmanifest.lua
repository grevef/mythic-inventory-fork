--shared_scripts { '@FiniAC/fini_events.lua' }

fx_version 'cerulean'
games { 'gta5' } -- 'gta5' for GTAv / 'rdr3' for Red Dead 2, 'gta5','rdr3' for both
lua54 'yes'

client_script "@mythic-base/components/cl_error.lua"
client_script "@mythic-pwnzor/client/check.lua"
server_script "@oxmysql/lib/MySQL.lua"

description 'ARP Inventory'
name 'ARP: mythic-inventory'
author 'Cool People Team (Mainly Alzar)'
version '1.0.1'
url 'https://authenticrp.com'

ui_page 'ui/dist/index.html'

files {
    'ui/dist/*.*',
    'ui/dist/assets/*.*',
    "ui/images/items/*.webp"
}

client_scripts {
    'client/**/*.lua'
}

shared_scripts {
    '@ox_lib/init.lua',
    
    'config.lua',
    'schematic_config.lua',
    'items/**/*.lua',
    'shared/**/*.lua',
}

server_scripts {
    'crafting_config.lua',
    'server/**/*.lua'
}