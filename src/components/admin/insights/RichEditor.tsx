import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Youtube } from '@tiptap/extension-youtube';
import {
  Bold, Italic, UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Image as ImageIcon, Link as LinkIcon,
  Minus, AlignLeft, AlignCenter, AlignRight, Highlighter, Youtube as YoutubeIcon, Table as TableIcon, Maximize2, Minimize2, Undo2, Redo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useProcessedUpload } from '@/hooks/useProcessedUpload';
import { cn } from '@/lib/utils';

interface Props {
  initialHtml?: string;
  onChange?: (html: string, json: any) => void;
  productName?: string;
  fullScreen?: boolean;
}

const Btn = ({ active, onClick, title, children }: any) => (
  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} title={title}
    className={cn('h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground',
      active && 'bg-primary text-primary-foreground hover:bg-primary')}>
    {children}
  </button>
);

const Toolbar = ({ editor, productName, fs, setFs }: { editor: Editor; productName?: string; fs: boolean; setFs: (v: boolean) => void }) => {
  const { upload, isUploading } = useProcessedUpload({ folder: 'insights', productName });

  const pickImage = async () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const url = await upload(file);
      if (url) editor.chain().focus().setImage({ src: url, alt: productName || '' }).run();
    };
    input.click();
  };

  const addLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank' }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border sticky top-0 bg-background z-30">
      <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 className="h-4 w-4" /></Btn>
      <span className="w-px h-5 bg-border mx-1" />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight"><Highlighter className="h-4 w-4" /></Btn>
      <span className="w-px h-5 bg-border mx-1" />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code"><Code className="h-4 w-4" /></Btn>
      <span className="w-px h-5 bg-border mx-1" />
      <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left"><AlignLeft className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center"><AlignCenter className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right"><AlignRight className="h-4 w-4" /></Btn>
      <span className="w-px h-5 bg-border mx-1" />
      <Btn active={editor.isActive('link')} onClick={addLink} title="Link"><LinkIcon className="h-4 w-4" /></Btn>
      <Btn onClick={pickImage} title="Image"><ImageIcon className="h-4 w-4" /></Btn>
      <Btn onClick={() => { const u = prompt('YouTube URL'); if (u) editor.chain().focus().setYoutubeVideo({ src: u }).run(); }} title="YouTube"><YoutubeIcon className="h-4 w-4" /></Btn>
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Table"><TableIcon className="h-4 w-4" /></Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="h-4 w-4" /></Btn>
      <span className="w-px h-5 bg-border mx-1" />
      <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 className="h-4 w-4" /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 className="h-4 w-4" /></Btn>
      <div className="ml-auto flex items-center gap-2">
        {isUploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
        <Btn onClick={() => setFs(!fs)} title={fs ? 'Exit full screen' : 'Full screen'}>
          {fs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Btn>
      </div>
    </div>
  );
};

const RichEditor = ({ initialHtml = '', onChange, productName, fullScreen: forceFS = false }: Props) => {
  const [fs, setFs] = useState(forceFS);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank', class: 'text-primary underline' } }),
      Image,
      Placeholder.configure({ placeholder: 'Write your article…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      Youtube.configure({ controls: true, nocookie: true }),
    ],
    content: initialHtml,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML(), editor.getJSON()),
    editorProps: {
      attributes: {
        class: 'insight-prose max-w-3xl mx-auto min-h-[400px] focus:outline-none px-4 sm:px-6 py-6',
      },
    },
  });

  // Hydrate when initialHtml first arrives (e.g. when editing an existing article).
  const hydrated = useRef(false);
  useEffect(() => {
    if (!editor || hydrated.current) return;
    if (initialHtml) {
      editor.commands.setContent(initialHtml, false as any);
      hydrated.current = true;
    }
  }, [initialHtml, editor]);

  if (!editor) return null;

  return (
    <div className={cn('bg-card border border-border rounded-xl overflow-hidden flex flex-col',
      fs && 'fixed inset-0 z-50 rounded-none border-0')}>
      <Toolbar editor={editor} productName={productName} fs={fs} setFs={setFs} />
      <div className={cn('overflow-auto bg-background', fs ? 'flex-1' : 'max-h-none')}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichEditor;