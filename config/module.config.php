<?php
namespace OhmsEmbed;

return [
    'file_renderers' => [
        'invokables' => [
            'ohms_embed' => Media\FileRenderer\OhmsEmbedRenderer::class,
        ],
        'aliases' => [
            'application/xml' => 'ohms_embed',
            'xml' => 'ohms_embed',
        ],
    ],
    'extract_metadata_extractors' => [
        'invokables' => [
            'ohms' => Extractor\Ohms::class,
        ],
    ],
];
