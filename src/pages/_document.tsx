import { ServerResponse } from 'http';
import React from 'react';
import { renderToStaticNodeStream } from 'react-dom/server';

import Index from './index';
import Result from './result';
import Compare from './compare';
import NotFound from './404';
import ServerError from './500';
import ParseFailure from './parse-failure';

import { getResultProps } from '../page-props/results';
import { getCompareProps } from '../page-props/compare';

import { containerId, pages, productionHostname } from '../util/constants';
import OctocatCorner from '../components/OctocatCorner';
import Logo from '../components/Logo';
import { fetchManifest } from '../util/npm-api';
import { parsePackageString } from '../util/npm-parser';
import { NotFoundError } from '../util/not-found-error';
import type { NpmManifest, PackageVersion, ParsedUrlQuery } from '../types';

const existingPaths = new Set(Object.values(pages));
const logoSize = 108;
const css = `
:root {
    --brand-color: #16864d;
    --background: #fafafa;
    --foreground: #18181b;
    --muted: #e4e4e7;
    --muted-foreground: #3f3f46;
    --border: #d4d4d8;
    --search-input: #fff;
}

@media (prefers-color-scheme: dark) {
    :root {
        --brand-color: #32de85;
        --background: #09090b;
        --foreground: #f4f4f5;
        --muted: #27272a;
        --muted-foreground: #d4d4d8;
        --border: #3f3f46;
        --search-input: #18181b;
    }
}

body {
    margin: 0;
    padding: 0;
    background: var(--background);
    color: var(--foreground);
    font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif;    
}

*,
*::before,
*::after {
    box-sizing: border-box;
}

#spinwrap {
    display: none;
    height: 100vh;
    background: var(--background);
}

#spinner {
    height: ${logoSize}px;
    width: ${logoSize}px;
    margin-top: calc(50vh - ${logoSize / 2}px);
    margin-left: calc(50vw - ${logoSize / 2}px);
    animation: rotate 1s infinite linear;
  }
  
  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  } 

.content-container {
    display: flex;
}

.stats-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0 3rem;
}

@media screen and (max-width: 48em) {
    .content-container {
        flex-wrap: wrap;
    }
    .stats-container {
        margin: 0 auto;
    }

    .bar-graph-container {
        margin: 0 auto;
    }
}

#sponsors { margin-top: 1em; }

#sponsors:before {
    content: 'Sponsors';
    color: var(--muted-foreground);
    font-weight: 300;
    padding-left: 25%;
}

@media screen and (min-width: 75em) {
    #sponsors {
        position: absolute;
        top: 5vh;
        left: 1vw;
    }
}`;

export async function renderPage(
    res: ServerResponse,
    pathname: string,
    query: ParsedUrlQuery,
    tmpDir: string,
    gaId: string,
    reqId: string,
) {
    res.statusCode = getStatusCode(pathname);
    const force = query.force === '1';
    let inputStr = '';
    let manifest: NpmManifest | null = null;
    let pkgVersions: PackageVersion[] = [];
    let title = 'Package Phobia';
    let description =
        'Find the cost of adding a npm dependency to your Node.js project. Compare package install size and publish size over time.';
    if (pathname === pages.result && typeof query.p === 'string') {
        try {
            inputStr = query.p;
            pkgVersions = inputStr.split(',').map(parsePackageString);
            const first = pkgVersions[0];
            if (first) {
                manifest = await fetchManifest(first.name);
                if (pkgVersions.length === 1) {
                    title = `${manifest.name} - Package Phobia`;
                    description = `Find the size of the ${manifest.name} dependency before you npm install.`;
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
    res.write(`<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>${escapeHtml(title)}</title>
                <meta name="description" content="${escapeHtml(description)}">
                <style>${css}</style>
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
                <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
                <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png">
                <link rel="manifest" href="/site.webmanifest">
                <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#33aa33">
                <meta name="theme-color" content="#333333">
                <meta property="og:title" content="${escapeHtml(title)}">
                <meta property="og:image" content="https://${productionHostname}/logo.png">
                <meta property="og:description" content="${escapeHtml(description)}">
            </head>
            <body>
            <div id="spinwrap"><div></div><div id="spinner">${Logo('s')}</div></div>
            <script>
                const spinwrap = document.getElementById('spinwrap');
                spinwrap.style.display='block'
            </script>
            ${OctocatCorner()}
            <div id="${containerId}">`);
    const factory = await routePage(
        pathname,
        inputStr,
        pkgVersions,
        manifest,
        force,
        tmpDir,
        reqId,
    );
    const stream = renderToStaticNodeStream(factory);
    stream.pipe(res, { end: false });
    stream.on('end', () => {
        res.end(`</div>
                <script>
                    const forms = document.querySelectorAll('form')
                    const input = document.querySelector('input[type=file]');
                    spinwrap.style.display='none';
                    for (let form of forms)
                      form.onsubmit = () => spinwrap.style.display='block';
                    if (input) {
                        input.onchange = () => input.form.submit();
                    }
                </script>
                <script>
                    if ('${gaId}') {
                        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
                        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
                        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
                        })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

                        ga('create', '${gaId}', 'auto');
                        ga('send', 'pageview');
                    }
                </script>
            </body>
            </html>`);
    });
}

async function routePage(
    pathname: string,
    inputStr: string,
    pkgVersions: PackageVersion[],
    manifest: NpmManifest | null,
    force: boolean,
    tmpDir: string,
    reqId: string,
) {
    try {
        switch (pathname) {
            case pages.index:
                return <Index />;
            case pages.parseFailure:
                return <ParseFailure />;
            case pages.result:
                const first = pkgVersions[0];
                return pkgVersions.length === 1 ||
                    pkgVersions.every(p => p.name === first?.name && p.scoped == first?.scoped) ? (
                    <Result
                        {...await getResultProps(inputStr, pkgVersions, manifest, force, tmpDir)}
                    />
                ) : (
                    <Compare {...await getCompareProps(inputStr, pkgVersions, force, tmpDir)} />
                );
            default:
                return <NotFound resource={pathname} />;
        }
    } catch (err) {
        if (err instanceof NotFoundError) {
            return <NotFound resource={err.resource} />;
        }
        console.error('Unexpected Error Occurred...', err);
        return <ServerError reqId={reqId} />;
    }
}

function getStatusCode(pathname: string) {
    if (existingPaths.has(pathname)) {
        return 200;
    }
    return 404;
}

function escapeHtml(str: string): string {
    const entityMap: { [s: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
    };
    return str
        .split('')
        .map(s => entityMap[s] || s)
        .join('');
}
