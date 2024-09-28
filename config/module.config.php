<?php
return [
    'file_renderers' => [
        'invokables' => [
            'ohms_embed' => 'OhmsEmbed\Media\FileRenderer\OhmsEmbedRenderer',
        ],
        'aliases' => [
            'application/xml' => 'ohms_embed',
            'xml' => 'ohms_embed',
        ],
    ],
];
