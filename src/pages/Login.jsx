import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        const res = login(email, pass);
        if (!res.success) {
            setError(res.message);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(8px)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <h1 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.8rem' }}>Bem-vindo</h1>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            fontSize: '1rem',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Senha"
                        value={pass}
                        onChange={e => setPass(e.target.value)}
                        style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            fontSize: '1rem',
                            outline: 'none'
                        }}
                        required
                    />

                    {error && <div style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '8px' }}>{error}</div>}

                    <button type="submit" style={{
                        marginTop: '16px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#3b82f6',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}>
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
}
