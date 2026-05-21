import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';
import { Bold, List, Link as LinkIcon, Unlink, Eye, Edit2 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = "Write your announcement here..." 
}) => {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [sanitizedPreview, setSanitizedPreview] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-red-600 underline hover:text-red-800 transition-colors cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[150px] p-4 text-sm text-gray-700 leading-relaxed custom-editor tiptap-editor',
      },
    },
  });

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  useEffect(() => {
    if (mode === "preview" && editor) {
      const html = editor.getHTML();
      const cleanHtml = DOMPurify.sanitize(html);
      setSanitizedPreview(cleanHtml);
    }
  }, [mode, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return <div className="min-h-[150px] bg-gray-50 border border-gray-200 rounded-lg animate-pulse" />;
  }

  const charCount = editor.getText().length;

  return (
    <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm focus-within:ring-1 focus-within:ring-red-500 focus-within:border-red-500 transition-all">
      {/* Toolbar & Tabs */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-2 py-1.5 sticky top-0 z-10">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === "edit" ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent"
            }`}
          >
            <Edit2 size={14} /> Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === "preview" ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent"
            }`}
          >
            <Eye size={14} /> Preview
          </button>
        </div>

        {mode === "edit" && (
          <div className="flex items-center gap-1 px-2 border-l border-gray-200">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title="Bold (Cmd+B)"
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title="Bullet List"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={setLink}
              className={`p-1.5 rounded-md transition-colors ${
                editor.isActive('link') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title="Add Link"
            >
              <LinkIcon size={16} />
            </button>
            {editor.isActive('link') && (
              <button
                type="button"
                onClick={() => editor.chain().focus().unsetLink().run()}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Remove Link"
              >
                <Unlink size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editor / Preview Area */}
      <div className="relative min-h-[150px] max-h-[400px] overflow-y-auto custom-scrollbar bg-white">
        {mode === "edit" ? (
          <EditorContent editor={editor} className="editor-content-wrapper" />
        ) : (
          <div 
            className="prose prose-sm sm:prose max-w-none p-4 text-sm text-gray-700 leading-relaxed custom-editor"
            dangerouslySetInnerHTML={{ __html: sanitizedPreview || "<p class='text-gray-400 italic'>Nothing to preview.</p>" }} 
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="flex justify-end px-3 py-1.5 border-t border-gray-50 bg-gray-50/50">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${charCount === 0 ? 'text-gray-400' : 'text-gray-500'}`}>
          {charCount} Characters
        </span>
      </div>
    </div>
  );
};
