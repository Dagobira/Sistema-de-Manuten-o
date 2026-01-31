export default function ErrorState({ error, onRetry }) {
    return (
        <div className="error-container" role="alert" style={{
            color: '#dc2626',
            background: '#fee2e2',
            padding: '1rem',
            borderRadius: '0.5rem',
            textAlign: 'center',
            margin: '1rem 0'
        }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>❌ Ocorreu um erro</p>
            <p>{error}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                    }}
                >
                    Tentar Novamente
                </button>
            )}
        </div>
    );
}
