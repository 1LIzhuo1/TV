/* eslint-disable @typescript-eslint/no-explicit-any */

import he from 'he';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const SEARCH_ENDPOINT = 'https://duckduckgo.com/html/';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MIN_CONTENT_LENGTH = 2000;

const BLOCKED_LINE_PATTERNS = [
  /手机阅读/,
  /最新章节/,
  /章节目录/,
  /上一章/,
  /下一章/,
  /返回书页/,
  /加入书签/,
  /加入书架/,
  /推荐本书/,
  /收藏本站/,
  /最新网址/,
  /本站/,
  /阅读app/,
  /广告/,
  /求书/,
  /免费阅读/,
  /txt下载/i,
];

const CHAPTER_TITLE_PATTERN =
  /^(第.{1,15}(章|回|节)|序章|楔子|引子|前言|后记|尾声|番外)/;

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title')?.trim();
  const author = searchParams.get('author')?.trim() ?? '';
  const customUrl = searchParams.get('url')?.trim() ?? '';

  if (!title) {
    return NextResponse.json({ error: '缺少小说名' }, { status: 400 });
  }

  try {
    const { content, sourceUrl } = customUrl
      ? await fetchNovelFromUrl(customUrl, title, author)
      : await searchAndFetchNovel(title, author);

    if (!content) {
      return NextResponse.json(
        { error: '未找到可用的小说正文，请尝试更换关键词或提供直链。' },
        { status: 404 }
      );
    }

    const filename = buildFilename(title, author);

    return NextResponse.json({
      filename,
      content,
      sourceUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || '小说抓取失败，请稍后再试。' },
      { status: 500 }
    );
  }
}

async function searchAndFetchNovel(title: string, author: string) {
  const query = `${title} ${author} 小说 正文 txt`;
  const searchUrl = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
  const searchResponse = await fetchWithTimeout(searchUrl, {
    headers: {
      'user-agent': USER_AGENT,
    },
  });

  if (!searchResponse.ok) {
    throw new Error('搜索引擎不可用');
  }

  const html = await searchResponse.text();
  const candidateUrls = extractSearchResultLinks(html).slice(0, 6);

  for (const url of candidateUrls) {
    try {
      const result = await fetchNovelFromUrl(url, title, author);
      if (result.content && result.content.length >= MIN_CONTENT_LENGTH) {
        return result;
      }
    } catch (error) {
      // 忽略单个来源失败，继续尝试下一个
    }
  }

  return { content: '', sourceUrl: '' };
}

async function fetchNovelFromUrl(
  url: string,
  title: string,
  author: string
): Promise<{ content: string; sourceUrl: string }> {
  if (!url.startsWith('http')) {
    throw new Error('无效的来源链接');
  }

  const response = await fetchWithTimeout(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error('来源链接不可用');
  }

  const html = await response.text();
  const rawText = extractReadableText(html);
  const formatted = formatNovelText(rawText, title, author);

  return {
    content: formatted,
    sourceUrl: url,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractSearchResultLinks(html: string) {
  const links: string[] = [];
  const regex = /class="result__a"[^>]*href="([^"]+)"/gi;
  let match = regex.exec(html);
  while (match) {
    const resolved = resolveDuckDuckGoLink(match[1]);
    if (resolved && resolved.startsWith('http')) {
      links.push(resolved);
    }
    match = regex.exec(html);
  }

  return Array.from(new Set(links));
}

function resolveDuckDuckGoLink(link: string) {
  try {
    const url = new URL(link);
    if (url.hostname.includes('duckduckgo.com') && url.pathname === '/l/') {
      const target = url.searchParams.get('uddg');
      if (target) {
        return decodeURIComponent(target);
      }
    }
    return link;
  } catch (error) {
    return link;
  }
}

function extractReadableText(html: string) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<(header|footer|nav|aside)[\s\S]*?<\/\1>/gi, '');

  const withBreaks = stripped
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n');

  const text = withBreaks.replace(/<[^>]+>/g, '\n');
  return he.decode(text);
}

function formatNovelText(rawText: string, title: string, author: string) {
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u00a0\u3000]+/g, ' ');

  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .filter((line) => !BLOCKED_LINE_PATTERNS.some((pattern) => pattern.test(line)));

  const paragraphs: string[] = [];
  for (const line of lines) {
    if (CHAPTER_TITLE_PATTERN.test(line)) {
      if (paragraphs.length > 0) {
        paragraphs.push('');
      }
      paragraphs.push(line);
      paragraphs.push('');
      continue;
    }

    paragraphs.push(line);
  }

  const body = paragraphs.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const headerLines = [title];
  if (author) {
    headerLines.push(`作者：${author}`);
  }
  headerLines.push('');

  return `${headerLines.join('\n')}${body}`.trim() + '\n';
}

function buildFilename(title: string, author: string) {
  const safeTitle = sanitizeFilenamePart(title);
  const safeAuthor = sanitizeFilenamePart(author);
  return safeAuthor ? `${safeTitle}-${safeAuthor}.txt` : `${safeTitle}.txt`;
}

function sanitizeFilenamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
