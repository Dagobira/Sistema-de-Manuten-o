export default function LoadingState({ message = "Carregando..." }) {
    return (
        <div className="loading-container" role="status">
            <div className="spinner" aria-hidden="true" style={{
                border: "4px solid rgba(0,0,0,0.1)",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                borderLeftColor: "#09f",
                animation: "spin 1s ease infinite",
                margin: "0 auto 10px"
            }}></div>
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .loading-container { text-align: center; padding: 20px; color: #666; }
            `}</style>
            <p>{message}</p>
        </div>
    );
}
