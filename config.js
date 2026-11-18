// config.js
const SUPABASE_URL = 'https://jqvnbzicwuacimfcpqjp.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxdm5iemljd3VhY2ltZmNwcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NzMxNDQsImV4cCI6MjExMDU0OTE0NH0._mps1P3T41GwatoVPfhBRk9dYfAwuRY_osdl_7K-fmQ';

if (!window.supabase) {
    console.error('Lỗi: Thư viện Supabase CDN chưa được tải.');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tiện ích định dạng ngày giờ chuẩn Việt Nam (tránh lệch múi giờ UTC)
const DateUtils = {
    toLocalDateStr(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },
    formatTime(isoString) {
        if (!isoString) return '--:--';
        const d = new Date(isoString);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    },
    // Tính ngày trực dựa trên quy tắc: 08:00 hôm nay -> 08:00 hôm sau thuộc ngày hôm nay
    getShiftDateFromTimestamp(isoString) {
        const d = new Date(isoString);
        if (d.getHours() < 8) {
            d.setDate(d.getDate() - 1);
        }
        return this.toLocalDateStr(d);
    }
};
