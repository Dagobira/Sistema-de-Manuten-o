import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminPanel() {
    const { users, addUser, editUserPermissions, getAccessibleScreens } = useAuth();

    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });
    const screens = getAccessibleScreens().filter(s => s !== 'admin'); // Admin sempre tem acesso a admin

    const handleAdd = (e) => {
        e.preventDefault();
        if (newUser.email && newUser.password) {
            addUser({ ...newUser, permissions: [] }); // Começa sem permissões específicas
            setNewUser({ name: '', email: '', password: '', role: 'user' });
            alert('Usuário criado!');
        }
    };

    const togglePermission = (userId, screen) => {
        const userToEdit = users.find(u => u.id === userId);
        if (!userToEdit) return;

        let newPerms = [...(userToEdit.permissions || [])];
        if (newPerms.includes(screen)) {
            newPerms = newPerms.filter(p => p !== screen);
        } else {
            newPerms.push(screen);
        }
        editUserPermissions(userId, newPerms);
    };

    return (
        <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Painel Administrativo</h2>

            {/* Adicionar Usuário */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Adicionar Usuário</h3>
                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
                    <input className="search-input" placeholder="Nome" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                    <input className="search-input" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                    <input className="search-input" placeholder="Senha" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                    <select className="filter-select" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                        <option value="user">Usuário</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="btn-export" style={{ background: '#10b981' }}>+ Criar</button>
                </form>
            </div>

            {/* Lista de Usuários */}
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '16px', textAlign: 'left' }}>Usuário</th>
                            <th style={{ padding: '16px', textAlign: 'left' }}>Role</th>
                            <th style={{ padding: '16px', textAlign: 'left' }}>Permissões de Acesso</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '16px' }}>
                                    <div style={{ fontWeight: '600' }}>{u.name}</div>
                                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{u.email}</div>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: u.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                                        color: u.role === 'admin' ? '#1e40af' : '#374151',
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        {u.role}
                                    </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    {u.role === 'admin' ?
                                        <span style={{ color: '#10b981', fontWeight: 600 }}>Acesso Total</span>
                                        :
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                            {screens.map(screen => (
                                                <label key={screen} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={u.permissions?.includes(screen)}
                                                        onChange={() => togglePermission(u.id, screen)}
                                                    />
                                                    <span style={{ textTransform: 'capitalize' }}>{screen}</span>
                                                </label>
                                            ))}
                                        </div>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
