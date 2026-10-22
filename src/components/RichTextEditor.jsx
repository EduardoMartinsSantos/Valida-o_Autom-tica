import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'

const FONT_SIZES = [
  { label: 'Pequeno', value: '12px' },
  { label: 'Normal', value: '' },
  { label: 'Grande', value: '20px' },
  { label: 'Muito grande', value: '26px' },
]

const htmlOf = (editor) => (editor.isEmpty ? '' : editor.getHTML())

export default function RichTextEditor({ labelId, value, onChange, invalid, readOnly = false }) {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, FontSize],
    content: value,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'rte-content',
        role: 'textbox',
        'aria-multiline': 'true',
        ...(labelId && { 'aria-labelledby': labelId }),
      },
    },
    onUpdate: ({ editor }) => onChange?.(htmlOf(editor)),
  })

  // Mantém o editor em sincronia quando o valor muda por fora (ex.: trocar a jornada editada).
  useEffect(() => {
    if (editor && value !== htmlOf(editor)) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold'),
      italic: editor?.isActive('italic'),
      underline: editor?.isActive('underline'),
      strike: editor?.isActive('strike'),
      bulletList: editor?.isActive('bulletList'),
      orderedList: editor?.isActive('orderedList'),
      fontSize: editor?.getAttributes('textStyle').fontSize ?? '',
    }),
  })

  if (!editor) return null

  // Modo leitura: o schema do editor descarta qualquer HTML fora do permitido.
  if (readOnly) return <EditorContent editor={editor} className="rte-readonly" />

  const chain = () => editor.chain().focus()

  const tools = [
    { key: 'bold', label: 'B', title: 'Negrito', run: () => chain().toggleBold().run() },
    { key: 'italic', label: 'I', title: 'Itálico', run: () => chain().toggleItalic().run() },
    { key: 'underline', label: 'U', title: 'Sublinhado', run: () => chain().toggleUnderline().run() },
    { key: 'strike', label: 'S', title: 'Riscado', run: () => chain().toggleStrike().run() },
    { key: 'bulletList', label: '•', title: 'Lista com marcadores', run: () => chain().toggleBulletList().run() },
    { key: 'orderedList', label: '1.', title: 'Lista numerada', run: () => chain().toggleOrderedList().run() },
  ]

  function setFontSize(size) {
    if (size) chain().setFontSize(size).run()
    else chain().unsetFontSize().run()
  }

  return (
    <div className={`rte${invalid ? ' invalid' : ''}`}>
      <div className="rte-toolbar" role="toolbar" aria-label="Formatação">
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`rte-btn rte-${t.key}${state[t.key] ? ' active' : ''}`}
            onClick={t.run}
            title={t.title}
            aria-label={t.title}
            aria-pressed={state[t.key]}
          >
            {t.label}
          </button>
        ))}
        <select
          className="rte-size"
          value={state.fontSize}
          onChange={(e) => setFontSize(e.target.value)}
          aria-label="Tamanho da letra"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
