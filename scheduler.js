const SchedulerService = {
  parseShifts(rosterRow) {
    let s1 = '', s2 = '', extra = [];
    if (rosterRow?.duty_type) {
      try {
        const parsed = JSON.parse(rosterRow.duty_type);
        s1 = parsed.s1 || '';
        s2 = parsed.s2 || '';
      } catch {
        s1 = rosterRow.duty_type;
      }
    }
    if (rosterRow?.rest_tier) {
      try {
        const parsedExtra = JSON.parse(rosterRow.rest_tier);
        if (Array.isArray(parsedExtra)) extra = parsedExtra;
      } catch {
        extra = [rosterRow.rest_tier];
      }
    }
    return { s1, s2, extra };
  },

  async saveRoster(shiftDate, staffId, payload) {
    const { data: existing } = await supabaseClient
      .from('daily_rosters')
      .select('*')
      .eq('shift_date', shiftDate)
      .eq('staff_id', staffId)
      .maybeSingle();

    const currentShifts = this.parseShifts(existing);
    const nextS1 = payload.s1 !== undefined ? payload.s1 : currentShifts.s1;
    const nextS2 = payload.s2 !== undefined ? payload.s2 : currentShifts.s2;
    const nextExtra = payload.extra !== undefined ? payload.extra : currentShifts.extra;

    const record = {
      shift_date: shiftDate,
      staff_id: staffId,
      duty_type: JSON.stringify({ s1: nextS1, s2: nextS2 }),
      rest_tier: JSON.stringify(nextExtra),
      day_rest_slot: payload.day_rest_slot !== undefined ? payload.day_rest_slot : (existing?.day_rest_slot || null),
      night_rest_slot: payload.night_rest_slot !== undefined ? payload.night_rest_slot : (existing?.night_rest_slot || null)
    };

    if (existing?.id) {
      const { error } = await supabaseClient.from('daily_rosters').update(record).eq('id', existing.id);
      if (error) alert('Lỗi lưu ca trực: ' + error.message);
    } else {
      const { error } = await supabaseClient.from('daily_rosters').insert(record);
      if (error) alert('Lỗi tạo ca trực: ' + error.message);
    }
  },

  async setDayOff(shiftDate, staffId, isOff) {
    if (isOff) {
      const { data: exist } = await supabaseClient
        .from('leave_requests')
        .select('id')
        .eq('staff_id', staffId)
        .eq('leave_date', shiftDate)
        .maybeSingle();

      if (!exist) {
        const { error } = await supabaseClient.from('leave_requests').insert({
          staff_id: staffId,
          leave_date: shiftDate,
          reason: 'Ca trưởng cắt OFF',
          status: 'approved',
          approved_by: currentUser?.id || null
        });
        if (error) alert('Lỗi cắt ngày OFF: ' + error.message);
      }
    } else {
      const { error } = await supabaseClient
        .from('leave_requests')
        .delete()
        .eq('staff_id', staffId)
        .eq('leave_date', shiftDate);
      if (error) alert('Lỗi hủy ngày OFF: ' + error.message);
    }
  }
};
