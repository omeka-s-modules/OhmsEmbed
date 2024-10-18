"use strict";

let jumpToTime;

async function getCachefile(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fetch failed (${response.status})`);
    }
    return response.text();
}

async function parse(url) {
    const cachefile = await getCachefile(url);
    const parser = new DOMParser;
    const doc = parser.parseFromString(cachefile, 'application/xml');
    const record = doc.documentElement.querySelector('record');

    const data = {
        title: getChildText(record, 'title'),
        accession: getChildText(record, 'accession'),
        sync: getChildText(record, 'sync'),
        sync_alt: getChildText(record, 'sync_alt'),
        duration: getChildText(record, 'duration'),
        collection_name: getChildText(record, 'collection_name'),
        collection_link: getChildText(record, 'collection_link'),
        series_name: getChildText(record, 'series_name'),
        series_link: getChildText(record, 'series_link'),
        fmt: getChildText(record, 'fmt'),
        media_url: getChildText(record, 'media_url'),
        file_name: getChildText(record, 'file_name'),
        rights: getChildText(record, 'rights'),
        usage: getChildText(record, 'usage'),
        repository: getChildText(record, 'repository'),
        repository_url: getChildText(record, 'repository_url'),
        kembed: getChildText(record, 'kembed'),
        language: getChildText(record, 'language'),
        transcript_alt_lang: getChildText(record, 'transcript_alt_lang'),
        translate: getChildText(record, 'translate'),
        funding: getChildText(record, 'funding'),
        user_notes: getChildText(record, 'user_notes'),
        transcript: getChildText(record, 'transcript'),
        transcript_alt: getChildText(record, 'transcript_alt'),
        vtt_transcript: getChildText(record, 'vtt_transcript'),
        vtt_transcript_alt: getChildText(record, 'vtt_transcript_alt'),
        interviewer: getChildrenTexts(record, 'interviewer'),
        interviewee: getChildrenTexts(record, 'interviewee'),
    }

    const mediafile = record.querySelector('mediafile');
    data['media_host'] = getChildText(mediafile, 'host');
    data['media_host_account_id'] = getChildText(mediafile, 'host_account_id');
    data['media_host_player_id'] = getChildText(mediafile, 'host_player_id');
    data['media_host_clip_id'] = getChildText(mediafile, 'host_clip_id');
    data['media_clip_format'] = getChildText(mediafile, 'clip_format');

    const indexPoints = record.querySelectorAll(':scope > index > point');
    data.index_points = Array.from(indexPoints, (point) => {
        const pointData = {
            time: parseInt(getChildText(point, 'time'), 10),
            title: getChildText(point, 'title'),
            title_alt: getChildText(point, 'title_alt'),
            partial_transcript: getChildText(point, 'partial_transcript').trim(),
            partial_transcript_alt: getChildText(point, 'partial_transcript_alt').trim(),
            synopsis: getChildText(point, 'synopsis').trim(),
            synopsis_alt: getChildText(point, 'synopsis_alt').trim(),
            keywords: getChildText(point, 'keywords').trim(),
            keywords_alt: getChildText(point, 'keywords_alt').trim(),
            subjects: getChildText(point, 'subjects').trim(),
            subjects_alt: getChildText(point, 'subjects_alt').trim(),
        };
        const gpsPoints = point.querySelectorAll(':scope > gpspoints');
        pointData.gps_points = Array.from(gpsPoints, (gpspoint) => {
            return {
                gps: getChildText(gpspoint, 'gps').trim(),
                gps_zoom: getChildText(gpspoint, 'gps_zoom').trim(),
                gps_text: getChildText(gpspoint, 'gps_text').trim(),
                gps_text_alt: getChildText(gpspoint, 'gps_text_alt').trim(),
            };
        });
        const hyperlinks = point.querySelectorAll(':scope > hyperlinks');
        pointData.hyperlinks = Array.from(hyperlinks, (hyperlink) => {
            return {
                hyperlink: getChildText(hyperlink, 'hyperlink').trim(),
                hyperlink_text: getChildText(hyperlink, 'hyperlink_text').trim(),
                hyperlink_text_alt: getChildText(hyperlink, 'hyperlink_text_alt').trim(),
            };
        });
        return pointData;
    });

    return data;
}

function ensureAbsolute(url) {
    const absRegex = /^https?:\/\//i;
    if (!absRegex.test(url)) {
        return 'http://' + url;
    }
    return url;
}

function getChildText(element, childName) {
    const child = element.querySelector(':scope > ' + childName);
    return child ? child.textContent : '';
}

function getChildrenTexts(element, childName) {
    const children = element.querySelectorAll(':scope > ' + childName);
    return Array.from(children, (child) => child.textContent);
}

function parseSyncString(sync) {
    const syncParts = sync.split(':');
    const syncData = new Map();
    if (syncParts.length !== 2) {
        return syncData;
    }

    let chunkSize = parseInt(syncParts[0], 10);
    if (!chunkSize) {
        chunkSize = 1;
    }

    const syncLines = syncParts[1].replace(/\(.*?\)/g, '').split('|');

    syncData.set(0, 0);
    syncLines.forEach((syncLine, index) => {
        const lineSeconds = (index) * chunkSize * 60;
        const lineNumber = parseInt(syncLine, 10);

        if (!lineNumber) {
            return;
        }

        syncData.set(lineNumber, lineSeconds);
    });

    return syncData;
}

function formatTime(seconds) {
    const h = (Math.floor(seconds / 3600) + '').padStart(2, '0');
    const m = (Math.floor((seconds % 3600) / 60) + '').padStart(2, '0');
    const s = (Math.floor(seconds % 60) + '').padStart(2, '0');

    return h + ':' + m + ':' + s;
}

function displayTranscript(transcript, sync, indexPoints) {
    const [realTranscript, footnoteContainer] = extractFootnotes(transcript);
    const lines = realTranscript.split('\n');
    const frag = document.createDocumentFragment();
    const speakerRegex = /^\s*([A-Z-.\' ]+:)(.*)$/;
    const footnoteRegex = /\[\[footnote\]\]([0-9]+?)\[\[\/footnote\]\]/;
    const syncData = parseSyncString(sync);

    const indexData = getIndexLines(syncData, indexPoints, lines.length);

    let para = document.createElement('p');
    let paraNew = true;
    lines.forEach((line, index) => {
        const lineLength = line.trim().length;
        // blank line: new paragraph
        if (lineLength === 0 && para.childElementCount > 0) {
            frag.appendChild(para);
            para = document.createElement('p');
            paraNew = true;
        }

        const span = document.createElement('span');

        const syncPoint = syncData.get(index);
        if (typeof syncPoint === 'number') {
            span.appendChild(createElement('a', {
                dataset: {seconds: syncPoint},
                textContent: formatTime(syncPoint),
                href: '#',
                className: 'timestamp-link',
            }));
        }

        const indexPoint = indexData.get(index);
        if (typeof indexPoint === 'number') {
            span.appendChild(createElement('a', {
                href: '#index-point-' + indexPoint,
                className: 'fa index-link',
                id: 'transcript-index-point-' + indexPoint,
                ariaLabel: 'Read index notes',
                title: 'Read index notes'
            }));
        }
        if (paraNew) {
            const matches = line.match(speakerRegex);
            if (matches) {
                span.appendChild(createElement('b', {textContent: matches[1]}));
                line = matches[2];
            }
        }
        const footnoteSplit = line.split(footnoteRegex);
        footnoteSplit.forEach((str, index) => {
            if (index % 2 === 0) {
                span.appendChild(document.createTextNode(str));
            } else {
                span.appendChild(createElement('a', {
                    textContent: '[' + str + ']',
                    id: 'fr' + str,
                    href: '#fn' + str,
                    className: 'footnote-link',
                }));
            }
        });

        para.appendChild(span);
        para.appendChild(document.createTextNode('\n'));

        if (lineLength > 0) {
            paraNew = false;
        }
    });
    frag.appendChild(para);
    if (footnoteContainer) {
        frag.appendChild(footnoteContainer);
    }
    return frag;
}

function getIndexLines(syncData, indexPoints) {
    const indexData = new Map();
    const syncArray = Array.from(syncData);

    if (syncArray.length === 0) {
        return indexData;
    }

    let syncIndex = 0;
    let [currentLine, currentTime] = syncArray[syncIndex];

    indexPoints.forEach((indexPoint, i) => {
        const indexTime = indexPoint.time;
        while (currentTime < indexTime && syncIndex < syncArray.length) {
            syncIndex++;
            [currentLine, currentTime] = syncArray[syncIndex];
        }
        if (currentTime > indexTime) {
            let [previousLine, previousTime] = syncArray[syncIndex - 1];
            let betweenLine = previousLine + Math.round((currentLine - previousLine) / (currentTime - previousTime) * (indexTime - previousTime));
            indexData.set(betweenLine, i);
        } else {
            indexData.set(currentLine, i);
        }

    });
    return indexData;
}

function extractFootnotes(transcript) {
    const regex = /\[\[footnotes\]\](.*)\[\[\/footnotes\]\]/s;
    const noteRegex = /\[\[note\]\](.*?)\[\[\/note\]\]/sg;
    const noteLinkRegex = /\[\[link\]\](.*?)\[\[\/link\]\]/s;
    const matches = transcript.split(regex);
    if (matches.length === 1) {
        return [transcript, null];
    } else {
        const footnotes = matches[1];
        const noteMatches = footnotes.matchAll(noteRegex);

        const footnoteContainer = createElement('div', {className: 'footnote-container'});
        footnoteContainer.appendChild(createElement('h2', {textContent: 'Footnotes'}));

        let footnoteIndex = 1;
        for (const noteMatch of noteMatches) {
            const footnote = createElement('p', {id: 'fn' + footnoteIndex});

            footnote.appendChild(createElement('a', {
                textContent: footnoteIndex,
                href: '#fr' + footnoteIndex,
                className: 'footnote-linkback',
            }));
            footnote.appendChild(document.createTextNode(' '));

            let noteContents = noteMatch[1];
            let noteUrl;
            noteContents = noteContents.replace(noteLinkRegex, (linkMatch, linkText) => {
                noteUrl = linkText.trim();
                return '';
            });
            if (noteUrl) {
                footnote.appendChild(createElement('a', {
                    href: ensureAbsolute(noteUrl),
                    textContent: noteContents.trim(),
                }));
            } else {
               footnote.appendChild(document.createTextNode(noteContents.trim()));
            }
            footnoteContainer.appendChild(footnote);
            footnoteIndex++;
        }
        return [matches[0], footnoteContainer];
    }
}

function displayVttTranscript(vttTranscript, indexPoints) {
    const timingsRegex = /(^.*-->.*$)/m
    const voiceTagRegex = /<v(?:\.[^ \t>]+)?[ \t]([^>]*)>/
    const vttTagRegex = /<\/?[^>]*>/g
    const postCueRegex = /\n\n.*/ms
    const frag = document.createDocumentFragment();
    const vttArray = vttTranscript.split(timingsRegex);
    let previousTimestamp = null;
    let indexCounter = 0;
    for (let i = 1; i < vttArray.length; i+=2) {
        const timingsLine = vttArray[i];
        const caption = vttArray[i+1];
        const timestamp = parseVttTimestamp(timingsLine);

        const para = document.createElement('p');
        const span = document.createElement('span');

        if (timestamp !== previousTimestamp) {
            span.appendChild(createElement('a', {
                dataset: {seconds: timestamp},
                textContent: formatTime(timestamp),
                href: '#',
                className: 'timestamp-link',
            }));
            previousTimestamp = timestamp;

            // treat index points within a second of the line start time as being on this line
            while (indexCounter < indexPoints.length && indexPoints[indexCounter].time <= timestamp + 1) {
                span.appendChild(createElement('a', {
                    href: '#index-point-' + indexCounter,
                    className: 'fa index-link',
                    id: 'transcript-index-point-' + indexCounter,
                    ariaLabel: 'Read index notes',
                    title: 'Read index notes'
                }));
                indexCounter++;
            }
        }

        caption.replace(postCueRegex, '').split(voiceTagRegex).forEach((captionText, j) => {
            if (j % 2 === 1) {
                span.appendChild(createElement('b', {textContent: captionText + ': '}));
            } else {
                span.appendChild(document.createTextNode(captionText.replaceAll(vttTagRegex, '')));
            }
        });

        para.appendChild(span);
        frag.appendChild(para);
    }
    return frag;
}

function parseVttTimestamp(timestamp) {
    const timestampRegex = /(?:([0-9]{2}):)?([0-9]{2}):([0-9]{2})\.([0-9]{3})/
    const match = timestamp.match(timestampRegex);
    let hours = 0, minutes = 0, seconds = 0;
    if (!match) {
        return null;
    }

    if (match[1]) {
        hours = parseInt(match[1], 10);
    }
    minutes = parseInt(match[2], 10);
    seconds = parseInt(match[3], 10);

    if (minutes > 59 || seconds > 59) {
        return null;
    }
    return (hours * 3600) + (minutes * 60) + seconds;
}

function displayMedia(data) {
    const player = document.querySelector('#player');
    const host = data.media_host.toLowerCase();
    switch (host) {
        case 'vimeo':
            let videoUrl;
            if (data.media_url) {
                videoUrl = data.media_url;
            } else if (data.kembed) {
                const parser = new DOMParser;
                const embedDoc = parser.parseFromString(data.kembed, 'text/html');
                const iframe = embedDoc.querySelector('iframe');
                videoUrl = iframe.src;
            } else {
                break;
            }

            {
                const script = document.createElement('script');
                script.src = 'https://player.vimeo.com/api/player.js';
                script.addEventListener('load', () => {
                    const vimeoPlayer = new Vimeo.Player(player, {url: videoUrl});

                    jumpToTime = async (seconds) => {
                        await vimeoPlayer.setCurrentTime(seconds);
                        if (await vimeoPlayer.getPaused()) {
                            vimeoPlayer.play();
                        }
                    };
                });
                document.body.appendChild(script);
            }
            break;
        case 'youtube':
            let videoId;
            if (data.media_url) {
                videoId = data.media_url.replace(/^https?:\/\/youtu.be\//, '');
            } else if (data.kembed) {
                const parser = new DOMParser;
                const embedDoc = parser.parseFromString(data.kembed, 'text/html');
                const iframe = embedDoc.querySelector('iframe');
                videoId = new URL(iframe.src).pathname.replace(/^\/embed\//, '');
            }
            {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                window.onYouTubeIframeAPIReady = function () {
                    const ytContainer = document.createElement('div');
                    ytContainer.id = 'youtube-player';
                    player.appendChild(ytContainer);
                    const ytPlayer = new YT.Player('youtube-player', {
                        width: '640',
                        height: '390',
                        videoId: videoId,
                        playerVars: {playsinline: 1}
                    });

                    jumpToTime = (seconds) => {
                        ytPlayer.seekTo(seconds, true);
                        if (ytPlayer.getPlayerState() !== 1) {
                            ytPlayer.playVideo();
                        }
                    };
                }
                document.body.appendChild(script);
            }
            break;
        case 'aviary':
            const url = new URL(data.media_url);
            if (!url.hostname.endsWith('.aviaryplatform.com')) {
                break;
            }

            player.appendChild(createElement('iframe', {
                src: data.media_url,
                width: 480,
                height: 270,
            }));

            break;
        case 'kaltura':
            if (data.kembed) {
                const parser = new DOMParser;
                const embedDoc = parser.parseFromString(data.kembed, 'text/html');
                const iframe = embedDoc.querySelector('iframe');
                const kalturaUrlRegex = /\/p\/([0-9]+)\/sp\/(?:[0-9]+)00\/embedIframeJs\/uiconf_id\/([0-9]+)\//;
                const iframeUrl = new URL(iframe.src);
                const query = new URLSearchParams(iframeUrl.search);
                const match = iframeUrl.pathname.match(kalturaUrlRegex);
                if (!match || !query.has('entry_id')) {
                    break;
                }
                const partnerId = match[1];
                const uiconfId = match[2];
                const entryId = query.get('entry_id');

                const script = document.createElement('script');
                script.src = `https://cdnapisec.kaltura.com/p/${partnerId}/sp/${partnerId}00/embedIframeJs/uiconf_id/${uiconfId}/partner_id/${partnerId}`;
                script.addEventListener('load', () => {
                    kWidget.embed({
                        targetId: 'player',
                        wid: '_' + partnerId,
                        uiconf_id: uiconfId,
                        entry_id: entryId,
                        readyCallback: (playerId) => {
                            const kdp = document.getElementById(playerId);

                            jumpToTime = (seconds) => {
                                kdp.sendNotification('doSeek', seconds);
                                kdp.sendNotification('doPlay');
                            }
                        }
                    });
                });
                document.body.appendChild(script);
            }

            break;
        case 'other':
            if (data.media_url) {
                let mediaElement = 'video';

                if (data.media_clip_format === 'audio') {
                    mediaElement = 'audio';
                    document.querySelector('#viewer').classList.add('audio');
                }

                const media = document.createElement(mediaElement);
                media.src = ensureAbsolute(data.media_url);
                media.controls = true;
                media.preload = 'auto';

                jumpToTime = (seconds) => {
                    media.pause();
                    media.currentTime = seconds;
                    media.play();
                };
                player.appendChild(media);
            }
            break;
    }
}

function displayIndex(indexPoints, translate) {
    const frag = document.createDocumentFragment();
    const translateKey = (key) => {
       return translate ? key + '_alt' : key;
    };

    indexPoints.forEach((indexPoint, i) => {
        const indexId = 'index-point-' + i;
        const div = createElement('div', {
            className: 'index-point',
            id: indexId,
        });

        div.appendChild(createElement('span', {
            className: 'index-title',
            textContent: indexPoint[translateKey('title')],
        }));

        const indexActions = createElement('div', {
            className: 'index-actions'
        });


        indexActions.appendChild(createElement('a', {
            dataset: {seconds: indexPoint.time},
            className: 'timestamp-link',
            textContent: formatTime(indexPoint.time),
            href: '#',
        }));

        indexActions.appendChild(createElement('a', {
            href: '#transcript-index-point-' + i,
            className: 'fa transcript-index-link',
            textContent: '',
            ariaLabel: 'View in transcript',
            title: 'View in transcript',
        }));

        indexActions.appendChild(createElement('button', {
            type: 'button',
            className: 'fa transcript-index-text-toggle',
            ariaLabel: 'Toggle',
            title: 'Toggle',
            ariaExpanded: 'false',
        }));

        div.appendChild(indexActions);

        const divContent = createElement('div', {
            className: 'index-point-content',
        });

        if (indexPoint[translateKey('partial_transcript')]) {
            divContent.appendChild(createElement('blockquote', {
                className: 'index-partial-transcript',
                textContent: indexPoint[translateKey('partial_transcript')],
            }));
        }

        if (indexPoint[translateKey('synopsis')]) {
            divContent.appendChild(createElement('span', {
                className: 'index-synopsis',
                textContent: indexPoint[translateKey('synopsis')],
            }));
        }

        const indexPointMetadata = [];
        indexPointMetadata.push(['index-keywords', 'Keywords', indexPoint[translateKey('keywords')].split(';').filter((e) => e)]);
        indexPointMetadata.push(['index-subjects', 'Subjects', indexPoint[translateKey('subjects')].split(';').filter((e) => e)]);

        const mapLinks = [];
        indexPoint.gps_points.forEach((gpsPoint) => {
            if (!gpsPoint.gps) {
                return;
            }
            const zoom = gpsPoint.gps_zoom || '17';
            const text = gpsPoint[translateKey('gps_text')] || 'View on map';
            const mapUrl = 'https://maps.google.com/maps?ll=' + gpsPoint.gps + '&z=' + zoom + '&t=m';

            mapLinks.push(createElement('a', {
                href: mapUrl,
                target: '_blank',
                textContent: text,
            }));
        });
        indexPointMetadata.push(['index-locations', 'Locations', mapLinks]);

        const links = [];
        indexPoint.hyperlinks.forEach((hyperlink) => {
            if (!hyperlink.hyperlink) {
                return;
            }
            links.push(createElement('a', {
                href: ensureAbsolute(hyperlink.hyperlink),
                target: '_blank',
                textContent: hyperlink[translateKey('hyperlink_text')] || hyperlink.hyperlink,
            }));
        });
        indexPointMetadata.push(['index-hyperlinks', 'Links', links]);

        indexPointMetadata.forEach((metadataInfo) => {
            const [className, label, data] = metadataInfo;
            if (!data.length) {
                return;
            }

            const container = document.createElement('div');
            container.classList.add('index-meta', className);
            container.appendChild(createElement('b', {textContent: label + ":"}));

            let separator = ' ';
            data.forEach((datum) => {
                container.append(separator, datum);
                separator = '; ';
            });
            divContent.appendChild(container);
        });

        div.appendChild(divContent);
        frag.appendChild(div);
    });
    return frag;
}

function displayMetadata(data) {
    const metadata = document.querySelector('#main-metadata');
    const frag = document.createDocumentFragment();
    const title = data['title'] || 'Untitled';
    document.title = title;

    frag.appendChild(createElement('h1', {textContent: title}));

    frag.appendChild(createElement('span', {
        className: 'repository',
        textContent: data['repository'],
    }));

    metadata.appendChild(frag);
}

function displayTextContent(data, translate) {
    const viewer = document.querySelector('#viewer');
    const transcriptContainer = document.querySelector('#transcript');
    const indexContainer = document.querySelector('#index');
    viewer.classList.remove('no-transcript', 'no-index');
    let transcript, vttTranscript, sync;
    if (translate) {
        transcript = data.transcript_alt;
        vttTranscript = data.vtt_transcript_alt;
        sync = data.sync_alt;
    } else {
        transcript = data.transcript;
        vttTranscript = data.vtt_transcript;
        sync = data.sync;
    }
    if (vttTranscript) {
        transcriptContainer.replaceChildren(displayVttTranscript(vttTranscript, data.index_points));
    } else if (transcript) {
        transcriptContainer.replaceChildren(displayTranscript(transcript, sync, data.index_points));
    } else {
        transcriptContainer.replaceChildren();
        viewer.classList.add('no-transcript');
    }
    if (data.index_points.length) {
        indexContainer.replaceChildren(displayIndex(data.index_points, translate));
    } else {
        indexContainer.replaceChildren(viewer.classList.add('no-index'));
    }
}

function displayInfo(data) {
    const info = document.querySelector('#info-content');
    const dl = document.createElement('dl');
    const optionalLink = (text, url) => {
        if (url) {
            if (!text) {
                text = url;
            }
            return createElement('a', {
                textContent: text,
                href: ensureAbsolute(url),
                target: '_blank',
            });
        }
        return text;
    }
    const infoMetadata = {
        'Title': data.title,
        'Repository': optionalLink(data.repository, data.repository_url),
        'Collection': optionalLink(data.collection_name, data.collection_link),
        'Series': optionalLink(data.series_name, data.series_link),
        'Interviewee': data.interviewee,
        'Interviewer': data.interviewer,
        'Language': data.language,
        'Alternate Language': data.transcript_alt_lang,
        'Rights Statement': data.rights,
        'Usage Statement': data.usage,
        'Acknowledgment': data.funding,
    };

    for (const [label, value] of Object.entries(infoMetadata)) {
        if (!value || (Array.isArray(value) && !value.length)) {
            continue;
        }

        dl.appendChild(createElement('dt', {textContent: label}));

        const appendValue = (value) => {
            const dd = document.createElement('dd');
            dd.append(value);
            dl.appendChild(dd);
        };

        if (Array.isArray(value)) {
            value.forEach(appendValue);
        } else {
            appendValue(value);
        }
    }

    info.appendChild(dl);
}

function createElement(tagName, properties) {
    const element = document.createElement(tagName);
    if (Object.hasOwn(properties, 'dataset')) {
        for (const [key, value] of Object.entries(properties.dataset)) {
            element.dataset[key] = value;
        }
        delete properties.dataset;
    }
    Object.assign(element, properties);
    return element;
}

function setListeners() {
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('a.timestamp-link')) {
            e.preventDefault();
            if (jumpToTime && 'seconds' in target.dataset) {
                jumpToTime(target.dataset.seconds);
            }
            return;
        }
        if (target.matches('.transcript-index-text-toggle')) {
            const indexPoint = target.closest('.index-point');
            target.ariaExpanded = indexPoint.classList.toggle('active') ? 'true' : 'false';
            return;
        }
        if (target.matches('.index-link')) {
            const indexPointId = target.getAttribute('href').replace('#', '');
            const indexPoint = document.getElementById(indexPointId);
            if (!document.body.classList.contains('mobile-index-active')) {
                document.body.classList.add('mobile-index-active');
            }
            if (!indexPoint.classList.contains('active')) {
                indexPoint.ariaExpanded = indexPoint.classList.add('active');
            }
            return;
        }
        if (target.matches('.transcript-index-link') && document.body.classList.contains('mobile-index-active')) {
            document.body.classList.remove('mobile-index-active');
        }
        if (target.matches('#info-close')) {
            document.querySelector('#info').close();
        }
    });
}

function setUpControls(data) {
    const controls = document.querySelector('#controls');

    const indexMobileButton = createElement('button', {
        id: 'toggle-index',
        className: 'fa',
        type: 'button',
        textContent: 'Toggle index'
    })
    indexMobileButton.addEventListener('click', async () => {
        document.body.classList.toggle('mobile-index-active');
    });
    controls.appendChild(indexMobileButton);

    const infoButton = createElement('button', {
        id: 'show-info',
        className: 'fa',
        type: 'button',
        ariaLabel: 'Show info',
        title: 'Show info',
    });
    infoButton.addEventListener('click', () => {
        document.querySelector('#info').showModal();
    });
    controls.appendChild(infoButton);

    if (data.translate === '1') {
        const translateLabelStem = 'Swap Language to ';
        const originalLangLabel = translateLabelStem + (data.language || 'Original');
        const alternateLangLabel = translateLabelStem + (data.transcript_alt_lang || 'Alternate');
        let translating = false;
        const translateButton = createElement('button', {
            id: 'swap-language',
            className: 'fa',
            type: 'button',
            ariaLabel: alternateLangLabel,
            title: alternateLangLabel,
        });
        translateButton.addEventListener('click', (e) => {
            e.preventDefault();
            translating = !translating;
            const currentLabel = translating ? originalLangLabel : alternateLangLabel;
            translateButton.ariaLabel = currentLabel;
            translateButton.title = currentLabel;
            displayTextContent(data, translating);
        });
        controls.appendChild(translateButton);
    }
    if (document.fullscreenEnabled) {
        const fullscreenButton = createElement('button', {
            id: 'fullscreen',
            className: 'fa enter-fullscreen',
            type: 'button',
            ariaLabel: 'Fullscreen',
            title: 'Fullscreen'
        });
        fullscreenButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                fullscreenButton.ariaLabel = 'Fullscreen';
                fullscreenButton.title = 'Fullscreen';
                fullscreenButton.className = 'fa enter-fullscreen';
            } else {
                await document.body.requestFullscreen();
                fullscreenButton.ariaLabel = 'Exit Fullscreen';
                fullscreenButton.title = 'Exit Fullscreen';
                fullscreenButton.className = 'fa exit-fullscreen';
            }
        });
        controls.appendChild(fullscreenButton);
    }
}

async function main(params) {
    const url = params.cachefile;
    if (!url) {
        return;
    }

    console.log(params);
    if (params.link_color && /^[0-9A-Fa-f]{6}$/.test(params.link_color)) {
        document.documentElement.style.setProperty('--link-color', '#' + params.link_color);
    }
    const data = await parse(url);
    setUpControls(data);
    setListeners();
    if (params.metadata !== 'none') {
        displayMetadata(data);
    }
    displayMedia(data);
    displayTextContent(data, false);
    displayInfo(data);
}
