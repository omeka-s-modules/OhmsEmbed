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

        $namespaced = true;
        $recordQuery = $xpath->query('//o:ROOT/o:record');
        if (!$recordQuery->count()) {
            $recordQuery = $xpath->query('//ROOT/record');
            if (!$recordQuery->count()) {
                return $metadata;
            }
            $namespaced = false;
        }
        $record = $recordQuery->item(0);

        $xpaths = [
            'id' => '@id',
            'dt' => '@dt',
            'version' => 'version',
            'date' => 'date/@value',
            'date_nonpreferred_format' => 'date_nonpreferred_format',
            'cms_record_id' => 'cms_record_id',
            'title' => 'title',
            'accession' => 'accession',
            'duration' => 'duration',
            'collection_id' => 'collection_id',
            'collection_name' => 'collection_name',
            'series_id' => 'series_id',
            'series_name' => 'series_name',
            'repository' => 'repository',
            'funding' => 'funding',
            'repository_url' => 'repository_url',
            'file_name' => 'file_name',
            'transcript_alt_lang' => 'transcript_alt_lang',
            'media_id' => 'media_id',
            'media_url' => 'media_url',
            'language' => 'language',
            'user_notes' => 'user_notes',
            'type' => 'type',
            'description' => 'description',
            'rel' => 'rel',
            'rights' => 'rights',
            'fmt' => 'fmt',
            'usage' => 'usage',
            'xmllocation' => 'xmllocation',
            'xmlfilename' => 'xmlfilename',
            'collection_link' => 'collection_link',
            'series_link' => 'series_link',
        ];

        foreach ($xpaths as $key => $xpathQuery) {
            if ($xpathQuery[0] !== '@' && $namespaced) {
                $xpathQuery = "o:$xpathQuery";
            }
            $xpathQuery = "string($xpathQuery)";
            $result = $xpath->evaluate($xpathQuery, $record);
            if (!is_string($result) || $result === '') {
                continue;
            }
            $metadata[$key] = $result;
        }

        $xpathsMulti = [
            'subject' => 'subject',
            'keyword' => 'keyword',
            'interviewee' => 'interviewee',
            'interviewer' => 'interviewer',
            'format' => 'format',
        ];

        foreach ($xpathsMulti as $key => $xpathQuery) {
            if ($namespaced) {
                $xpathQuery = "o:$xpathQuery";
            }
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
