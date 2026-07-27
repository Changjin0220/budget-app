import { useState, useMemo } from 'react'
import { useApp } from '../data/store'
import { Card, useConfirm } from '../components/ui'
import { uid } from '../utils/id'
import { fmtDate } from '../utils/format'
import { IconSearch, IconEdit, IconTrash } from '../components/icons'

function newPost() {
  return { id: uid('post'), title: '', content: '' }
}

export default function Study() {
  const { state, mutate, isCommon } = useApp()
  const posts = state.posts || []
  const [confirm, confirmDialog] = useConfirm()

  const [mode, setMode] = useState('list') // list | write | view
  const [activeId, setActiveId] = useState(null)
  const [draft, setDraft] = useState(null)

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('title') // title | all

  const sorted = useMemo(() => [...posts].sort((a, b) => b.createdAt - a.createdAt), [posts])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((p) => {
      const hay = (scope === 'all' ? `${p.title} ${p.content}` : p.title).toLowerCase()
      return hay.includes(q)
    })
  }, [sorted, query, scope])
  const numberOf = (id) => sorted.length - sorted.findIndex((p) => p.id === id)

  const startWrite = () => { setDraft(newPost()); setMode('write') }
  const startEdit = (p) => { setDraft({ id: p.id, title: p.title, content: p.content }); setMode('write') }
  const openView = (p) => { setActiveId(p.id); setMode('view') }
  const backToList = () => { setMode('list'); setDraft(null); setActiveId(null) }

  const savePost = () => {
    if (!draft.title.trim()) return
    mutate((d) => {
      if (!d.posts) d.posts = []
      const now = Date.now()
      const idx = d.posts.findIndex((x) => x.id === draft.id)
      if (idx >= 0) {
        d.posts[idx] = { ...d.posts[idx], title: draft.title, content: draft.content, updatedAt: now }
      } else {
        d.posts.push({ id: draft.id, title: draft.title, content: draft.content, createdAt: now, updatedAt: now })
      }
    })
    backToList()
  }
  const removePost = async (id) => {
    if (!(await confirm('이 글을 삭제할까요?'))) return
    mutate((d) => { d.posts = (d.posts || []).filter((x) => x.id !== id) })
    backToList()
  }

  const activePost = posts.find((p) => p.id === activeId)

  return (
    <div className="grid">
      {mode === 'list' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>투자공부 기록</div>
            <span className="pill" style={{ background: 'var(--lav-100)', color: 'var(--lav-700)' }}>{posts.length}건</span>
            <div style={{ flex: 1 }} />
            <div className="seg">
              <button className={scope === 'title' ? 'on' : ''} onClick={() => setScope('title')}>제목</button>
              <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>제목+내용</button>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', display: 'flex', pointerEvents: 'none' }}>
                <IconSearch size={13} />
              </span>
              <input className="input" style={{ width: 200, paddingLeft: 30 }} placeholder="키워드 검색"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button className="btn primary" onClick={startWrite} disabled={isCommon}><IconEdit size={14} />글쓰기</button>
          </div>

          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="c" style={{ width: 64 }}>번호</th>
                  <th>제목</th>
                  {isCommon && <th style={{ width: 90 }}>작성자</th>}
                  <th className="r" style={{ width: 110 }}>날짜</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={isCommon ? 4 : 3}><div className="empty">
                    {query ? '검색 결과가 없어요' : '아직 기록한 글이 없어요. 글쓰기로 첫 공부 기록을 남겨보세요.'}
                  </div></td></tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} className="subtotal-row" onClick={() => openView(p)}>
                    <td className="c num" style={{ color: 'var(--ink-3)' }}>{numberOf(p.id)}</td>
                    <td style={{ fontWeight: 700 }}>{p.title || '(제목 없음)'}</td>
                    {isCommon && <td>{p._owner && <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{p._owner}</span>}</td>}
                    <td className="r num helper">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {mode === 'write' && draft && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{posts.some((x) => x.id === draft.id) ? '글 수정' : '글쓰기'}</div>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={backToList}>취소</button>
            <button className="btn primary" onClick={savePost} disabled={!draft.title.trim()}>저장</button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <label>제목</label>
              <input className="input" value={draft.title} placeholder="제목을 입력하세요"
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>내용</label>
              <textarea className="input" value={draft.content} placeholder="공부한 내용을 자유롭게 적어보세요"
                style={{ minHeight: 340, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} />
            </div>
          </div>
        </Card>
      )}

      {mode === 'view' && activePost && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 900, wordBreak: 'break-word' }}>{activePost.title}</div>
              <div className="helper" style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{fmtDate(activePost.createdAt)}</span>
                {activePost.updatedAt && activePost.updatedAt !== activePost.createdAt && <span>· 수정됨 {fmtDate(activePost.updatedAt)}</span>}
                {isCommon && activePost._owner && <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{activePost._owner}</span>}
              </div>
            </div>
            <button className="btn ghost sm" onClick={backToList}>목록으로</button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 14, minHeight: 100, wordBreak: 'break-word' }}>
            {activePost.content || <span className="helper">내용이 없어요</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button className="btn ghost sm" onClick={() => startEdit(activePost)} disabled={isCommon}><IconEdit size={13} />수정</button>
            <button className="btn ghost sm danger" onClick={() => removePost(activePost.id)} disabled={isCommon}><IconTrash size={13} />삭제</button>
          </div>
        </Card>
      )}

      {confirmDialog}
    </div>
  )
}
