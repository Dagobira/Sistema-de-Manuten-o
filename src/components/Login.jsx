import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await login(username, password);
            if (!res.success) {
                setError(res.message);
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Erro crítico ao processar login.');
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <img
                        src="/logo-gestaovx.png"
                        alt="Logo"
                        style={{ height: '60px', marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.2))' }}
                        onError={(e) => e.target.style.display = 'none'}
                    />
                    <h2 style={styles.title}>Gestão VX</h2>
                    <p style={styles.subtitle}>Enterprise Security Access</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={styles.label}>Usuário</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={styles.input}
                            placeholder="Digite seu usuário..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label style={styles.label}>Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            placeholder="••••••••"
                        />
                    </div>

                    {error && <div style={styles.error}>{error}</div>}

                    <button type="submit" style={styles.button}>
                        Acessar Sistema 🔓
                    </button>
                </form>

                <div style={styles.footer}>
                    © 2026 Gestão VX • Tech Division
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        fontFamily: '"Inter", sans-serif',
    },
    card: {
        width: '400px',
        padding: '40px',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    title: {
        color: '#fff',
        fontSize: '28px',
        fontWeight: '700',
        margin: 0,
        letterSpacing: '-0.5px'
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: '14px',
        marginTop: '6px'
    },
    label: {
        display: 'block',
        color: '#cbd5e1',
        fontSize: '13px',
        fontWeight: '600',
        marginBottom: '8px',
        marginLeft: '4px'
    },
    input: {
        width: '100%',
        padding: '14px 16px',
        background: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '15px',
        outline: 'none',
        transition: 'all 0.2s',
    },
    button: {
        width: '100%',
        padding: '16px',
        marginTop: '10px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        border: 'none',
        borderRadius: '12px',
        color: 'white',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.2s',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
    },
    error: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#f87171',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '13px',
        textAlign: 'center',
        fontWeight: '500'
    },
    footer: {
        marginTop: '32px',
        textAlign: 'center',
        color: '#475569',
        fontSize: '12px'
    }
};
