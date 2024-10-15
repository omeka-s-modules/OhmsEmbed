<?php
namespace OhmsEmbed\Extractor;

use DomDocument;
use DomXpath;
use ExtractMetadata\Extractor\ExtractorInterface;

class Ohms implements ExtractorInterface
{
    public function getLabel()
    {
        return 'OHMS';
    }

    public function isAvailable()
    {
        return extension_loaded('dom');
    }

    public function supports($mediaType)
    {
        return in_array($mediaType, [
            'text/xml',
            'application/xml',
        ]);
    }

    public function extract($filePath, $mediaType)
    {
        $metadata = [];
        $doc = new DomDocument;
        $doc->load($filePath);

        $xpath = new DOMXPath($doc);
        $xpath->registerNamespace('o', 'https://www.weareavp.com/nunncenter/ohms');

        $recordQuery = $xpath->query('//o:ROOT/o:record');
        if (!$recordQuery->count()) {
            return $metadata;
        }
        $record = $recordQuery->item(0);

        $xpaths = [
            'id' => 'string(@id)',
            'dt' => 'string(@dt)',
            'version' => 'string(o:version)',
            'date' => 'string(o:date/@value)',
            'date_nonpreferred_format' => 'string(o:date_nonpreferred_format)',
            'cms_record_id' => 'string(ocms_record_id)',
            'title' => 'string(o:title)',
            'accession' => 'string(o:accession)',
            'duration' => 'string(o:duration)',
            'collection_id' => 'string(o:collection_id)',
            'collection_name' => 'string(o:collection_name)',
            'series_id' => 'string(o:series_id)',
            'series_name' => 'string(o:series_name)',
            'repository' => 'string(o:repository)',
            'funding' => 'string(o:funding)',
            'repository_url' => 'string(o:repository_url)',
            'file_name' => 'string(o:file_name)',
            'transcript_alt_lang' => 'string(o:transcript_alt_lang)',
            'media_id' => 'string(o:media_id)',
            'media_url' => 'string(o:media_url)',
            'language' => 'string(o:language)',
            'user_notes' => 'string(o:user_notes)',
            'type' => 'string(o:type)',
            'description' => 'string(o:description)',
            'rel' => 'string(o:rel)',
            'rights' => 'string(o:rights)',
            'fmt' => 'string(o:fmt)',
            'usage' => 'string(o:usage)',
            'xmllocation' => 'string(o:xmllocation)',
            'xmlfilename' => 'string(o:xmlfilename)',
            'collection_link' => 'string(o:collection_link)',
            'series_link' => 'string(o:series_link)',
        ];

        foreach ($xpaths as $key => $xpathQuery) {
            $result = $xpath->evaluate($xpathQuery, $record);
            if (!is_string($result) || $result === '') {
                continue;
            }
            $metadata[$key] = $result;
        }

        $xpathsMulti = [
            'subject' => 'o:subject',
            'keyword' => 'o:keyword',
            'interviewee' => 'o:interviewee',
            'interviewer' => 'o:interviewer',
            'format' => 'o:format',
        ];

        foreach ($xpathsMulti as $key => $xpathQuery) {
            $result = $xpath->query($xpathQuery, $record);
            foreach ($result as $element) {
                $text = $element->textContent;
                if ($text === '') {
                    continue;
                }
                $metadata[$key][] = $text;
            }
        }

        return $metadata;
    }
}
