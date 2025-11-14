<?php

namespace OhmsEmbed\Media\FileRenderer;

use Omeka\Api\Representation\MediaRepresentation;
use Omeka\Media\FileRenderer\RendererInterface;
use Laminas\View\Renderer\PhpRenderer;

class OhmsEmbedRenderer implements RendererInterface
{
    public function render(PhpRenderer $view, MediaRepresentation $media, array $options = [])
    {
        $query = [
            'cachefile' => $media->originalUrl(),
        ];
        return sprintf(
            '<iframe src="%s?%s" style="width: 100%%; height: 800px;" title="%s" allowfullscreen></iframe>',
            $view->assetUrl('vendor/ohmsjs/ohms.html', 'OhmsEmbed', false, false),
            http_build_query($query),
            $view->escapeHtml($media->altText())
        );
    }
}
