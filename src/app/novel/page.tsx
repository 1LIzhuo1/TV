'use client';

import { BookOpenText, Download, Link as LinkIcon, Loader2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import PageLayout from '@/components/PageLayout';

interface NovelResponse {
  filename: string;
  content: string;
  sourceUrl: string;
}

const DEFAULT_STATUS = '填写小说名和作者后，系统会自动深度搜索并生成 TXT。';

export default function NovelPage() {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [preview, setPreview] = useState('');
  const [resolvedSource, setResolvedSource] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = useMemo(() => title.trim().length > 0 && !isLoading, [
    title,
    isLoading,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setStatus('请先输入小说名。');
      return;
    }

    setIsLoading(true);
    setStatus('正在深度搜索并抓取正文，请稍候…');
    setPreview('');
    setResolvedSource('');

    try {
      const params = new URLSearchParams();
      params.set('title', title.trim());
      if (author.trim()) {
        params.set('author', author.trim());
      }
      if (sourceUrl.trim()) {
        params.set('url', sourceUrl.trim());
      }

      const response = await fetch(`/api/novel?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || '抓取失败，请稍后再试。');
      }

      const data = (await response.json()) as NovelResponse;
      setResolvedSource(data.sourceUrl || '');
      setPreview(data.content.slice(0, 4000));
      setStatus('已生成 TXT，正在下载…');
      triggerDownload(data.filename, data.content);
      setStatus('下载已开始，如未弹出请检查浏览器下载栏。');
    } catch (error: any) {
      setStatus(error?.message || '抓取失败，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout activePath='/novel'>
      <div className='px-4 md:px-8 py-6'>
        <div className='max-w-4xl mx-auto space-y-6'>
          <header className='space-y-2'>
            <div className='flex items-center gap-3 text-green-600'>
              <BookOpenText className='h-7 w-7' />
              <h1 className='text-2xl font-semibold text-gray-900 dark:text-gray-100'>
                小说深度搜索 + TXT 下载
              </h1>
            </div>
            <p className='text-sm text-gray-600 dark:text-gray-300'>
              输入小说名和作者后，系统会自动在全网检索正文并进行基础纠错排版，生成可下载的 TXT。
              请确保内容为公开授权或可合法访问的资源。
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            className='rounded-2xl border border-gray-200/60 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-700/60 dark:bg-gray-900/60'
          >
            <div className='grid gap-4 md:grid-cols-2'>
              <label className='space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200'>
                小说名
                <input
                  type='text'
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder='例如：三体'
                  className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
                />
              </label>
              <label className='space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200'>
                作者（可选）
                <input
                  type='text'
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder='例如：刘慈欣'
                  className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
                />
              </label>
            </div>

            <label className='mt-4 flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200'>
              来源直链（可选）
              <input
                type='url'
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder='如已知正文页面地址，可直接粘贴以提高命中率'
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
              />
            </label>

            <div className='mt-6 flex flex-wrap items-center gap-3'>
              <button
                type='submit'
                disabled={!canSubmit}
                className='inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400'
              >
                {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Download className='h-4 w-4' />}
                {isLoading ? '处理中…' : '生成并下载 TXT'}
              </button>
              <p className='text-xs text-gray-500 dark:text-gray-400'>{status}</p>
            </div>
          </form>

          <section className='rounded-2xl border border-gray-200/60 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-700/60 dark:bg-gray-900/60'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                抓取结果预览
              </h2>
              {resolvedSource && (
                <a
                  href={resolvedSource}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700'
                >
                  <LinkIcon className='h-3 w-3' />
                  查看来源
                </a>
              )}
            </div>
            <textarea
              value={preview}
              readOnly
              placeholder='暂无内容预览，请先生成 TXT。'
              className='mt-4 h-72 w-full resize-none rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-800 shadow-inner focus:outline-none dark:border-gray-700 dark:bg-gray-950/70 dark:text-gray-100'
            />
          </section>
        </div>
      </div>
    </PageLayout>
  );
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
