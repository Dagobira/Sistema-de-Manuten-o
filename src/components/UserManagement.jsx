import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function UserManagement() {
    const { usersList: users, createUser, updateUser, deleteUser, user: currentUser } = useAuth();

    const [newUser, setNewUser] = useState({ username: '', password: '' });
    const [permissions, setPermissions] = useState(defaultPerms());
    const [msg, setMsg] = useState('');

    // Estado para Edição
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ password: '', active: true, permissions: [] });

    if (currentUser?.role !== 'super_admin') {
        return <div style={{ padding: 40, color: 'red' }}>Acesso Negado.</div>;
    }

    function defaultPerms() {
        return { analise: false, logistica: false, remanejamento: false, compras: false, qualidade: false, bi: false };
    }

    // Permissões Helper
    const permList = [
        { key: 'analise', label: '📊 Análise Lab' },
        { key: 'logistica', label: '🚚 Calendário' },
        { key: 'remanejamento', label: '🔄 Remanejamento' },
        { key: 'compras', label: '🛒 Compras' },
        { key: 'qualidade', label: '🛡️ Qualidade' },
        { key: 'bi', label: '💎 BI Perm' }
    ];

    /* --- CRIAÇÃO --- */
    const handleCreate = (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password) return;
        const permArray = Object.keys(permissions).filter(k => permissions[k]).map(k => `view_${k}`);
        const res = createUser(newUser.username, newUser.password, permArray);
        if (res.success) {
            setMsg('Usuário criado!');
            setNewUser({ username: '', password: '' });
            setPermissions(defaultPerms());
            setTimeout(() => setMsg(''), 3000);
        } else {
            setMsg(`Erro: ${res.message}`);
        }
    };

    /* --- EDIÇÃO --- */
    const openEdit = (u) => {
        setEditingUser(u);
        // Transforma array ['view_analise'] em objeto { analise: true }
        const userPerms = {};
        permList.forEach(p => {
            userPerms[p.key] = u.permissions.includes(`view_${p.key}`);
        });
        setEditForm({
            password: '', // Senha vazia = não alterar
            active: u.active !== false, // Default true se undefined
            permissions: userPerms
        });
    };

    const handleUpdate = () => {
        const permArray = Object.keys(editForm.permissions).filter(k => editForm.permissions[k]).map(k => `view_${k}`);
        updateUser(editingUser.id, {
            password: editForm.password,
            active: editForm.active,
            permissions: permArray
        });
        setEditingUser(null);
    };

    const toggleEditPerm = (key) => {
        setEditForm(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [key]: !prev.permissions[key] }
        }));
    };

    return (
        <div className="card" style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', minHeight: '80vh' }}>
            <h2 style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                🔐 Administração Total
            </h2>

            {/* CREATE FORM */}
            <form onSubmit={handleCreate} style={{ background: 'var(--bg)', padding: '24px', borderRadius: '12px', marginBottom: '32px', border: '1px solid var(--border)' }}>
                <h3 style={{ marginTop: 0, fontSize: '16px', color: 'var(--accent)' }}>✨ Novo Usuário</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <label style={styledLabel}>Login</label>
                        <input style={styledInput} value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="Gerente..." />
                    </div>
                    <div>
                        <label style={styledLabel}>Senha</label>
                        <input style={styledInput} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="******" />
                    </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={styledLabel}>Acessos Iniciais</label>
                    <div style={permGrid}>
                        {permList.map(p => (
                            <PermCheck key={p.key} label={p.label} checked={permissions[p.key]} onChange={() => setPermissions(old => ({ ...old, [p.key]: !old[p.key] }))} />
                        ))}
                    </div>
                </div>
                <button type="submit" style={styledBtn}>+ Criar</button>
                {msg && <span style={{ marginLeft: '12px', fontSize: '13px', color: msg.includes('Erro') ? 'red' : 'green' }}>{msg}</span>}
            </form>

            {/* LISTA */}
            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Usuários do Sistema</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'var(--table-header-bg)', textAlign: 'left', color: 'var(--textSec)', fontSize: '12px', textTransform: 'uppercase' }}>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Usuário</th>
                        <th style={thStyle}>Permissões Ativas</th>
                        <th style={thStyle}>Controles</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border2)', opacity: u.active === false ? 0.6 : 1 }}>
                            <td style={tdStyle}>
                                {u.role === 'super_admin' ? (
                                    <span style={badgeAdmin}>MASTER</span>
                                ) : (
                                    <span style={u.active !== false ? badgeActive : badgeInactive}>
                                        {u.active !== false ? 'ATIVO' : 'INATIVO'}
                                    </span>
                                )}
                            </td>
                            <td style={tdStyle}>
                                <span style={{ fontWeight: 600, fontSize: '14px' }}>{u.username}</span>
                            </td>
                            <td style={tdStyle}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {u.role === 'super_admin' ? (
                                        <span style={permBadge}>TUDO</span>
                                    ) : (
                                        u.permissions.map(p => <span key={p} style={permBadge}>{p.replace('view_', '')}</span>)
                                    )}
                                </div>
                            </td>
                            <td style={tdStyle}>
                                {u.role !== 'super_admin' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => openEdit(u)} style={editBtn}>✏️ Editar</button>
                                        <button onClick={() => deleteUser(u.id)} style={deleteBtn}>🗑️</button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* MODAL DE EDIÇÃO */}
            {editingUser && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3 style={{ marginTop: 0 }}>Editando: {editingUser.username}</h3>

                        <label style={styledLabel}>Status</label>
                        <div style={{ marginBottom: '16px' }}>
                            <button
                                type="button"
                                onClick={() => setEditForm(prev => ({ ...prev, active: true }))}
                                style={editForm.active ? btnToggleActive : btnToggle}
                            >Ativo</button>
                            <button
                                type="button"
                                onClick={() => setEditForm(prev => ({ ...prev, active: false }))}
                                style={!editForm.active ? btnToggleInactive : btnToggle}
                            >Inativo</button>
                            <p style={{ fontSize: '11px', color: 'var(--textSec)', margin: '4px 0' }}>Se inativo, o usuário não poderá logar.</p>
                        </div>

                        <label style={styledLabel}>Redefinir Senha (Opcional)</label>
                        <input
                            style={{ ...styledInput, marginBottom: '20px' }}
                            placeholder="Deixe em branco para manter a atual"
                            value={editForm.password}
                            onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                        />

                        <label style={styledLabel}>Permissões</label>
                        <div style={{ ...permGrid, marginBottom: '24px' }}>
                            {permList.map(p => (
                                <PermCheck key={p.key} label={p.label} checked={editForm.permissions[p.key]} onChange={() => toggleEditPerm(p.key)} />
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setEditingUser(null)} style={cancelBtn}>Cancelar</button>
                            <button onClick={handleUpdate} style={saveBtn}>Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const PermCheck = ({ label, checked, onChange }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', background: 'var(--border2)', padding: '8px', borderRadius: '6px' }}>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ cursor: 'pointer' }} />
        {label}
    </label>
);

/* ESTILOS */
const styledInput = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' };
const styledLabel = { display: 'block', fontSize: '11px', color: 'var(--textSec)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' };
const styledBtn = { background: 'var(--accent)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 };
const deleteBtn = { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' };
const editBtn = { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 };
const thStyle = { padding: '12px', fontWeight: 700 };
const tdStyle = { padding: '12px', fontSize: '13px', color: 'var(--text)', verticalAlign: 'middle' };
const permBadge = { background: 'var(--border2)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', color: 'var(--textSec)', textTransform: 'uppercase' };
const permGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' };

const badgeActive = { background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 };
const badgeInactive = { background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 };
const badgeAdmin = { background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 };

/* MODAL STYLES */
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
const modalContent = { background: 'var(--panel)', padding: '32px', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border)' };
const saveBtn = { background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 };
const cancelBtn = { background: 'transparent', color: 'var(--textSec)', border: 'none', padding: '12px 24px', cursor: 'pointer', fontWeight: 600 };

const btnToggle = { padding: '8px 16px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--textSec)', cursor: 'pointer', borderRadius: '6px', marginRight: '8px' };
const btnToggleActive = { ...btnToggle, background: '#22c55e', color: 'white', borderColor: '#22c55e', fontWeight: 700 };
const btnToggleInactive = { ...btnToggle, background: '#ef4444', color: 'white', borderColor: '#ef4444', fontWeight: 700 };
