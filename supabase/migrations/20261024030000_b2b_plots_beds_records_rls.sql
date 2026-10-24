-- ==============================================================================
-- NOU-ATO (のうあと) - B-2 (b): farm_plots / farm_beds / crop_records の RLS を
--                              農園所属 (farm_members) 基準へ切り替え
--
-- 講師の分岐「current_user_role() = 'teacher' AND <農園> = current_user_farm_id()」を
-- 「<農園> IN (SELECT current_user_farm_ids())」に置き換える (所属していれば講師)。
-- 生徒の分岐は変更しない。ポリシー名・対象ロール・操作は変更前と同じ。
-- 変更前の定義は本番 (pg_policies) と migrations で一致していることを B-0 で確認済み。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- farm_plots
-- ------------------------------------------------------------------------------
-- 変更前: auth.role() = 'authenticated' AND farm_id = current_user_farm_id()
DROP POLICY IF EXISTS "farm_plots_select_policy" ON public.farm_plots;
CREATE POLICY "farm_plots_select_policy" ON public.farm_plots
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            farm_id = public.current_user_farm_id()
            OR farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

-- 変更前: current_user_role() = 'teacher' AND farm_id = current_user_farm_id()
DROP POLICY IF EXISTS "farm_plots_modify_policy" ON public.farm_plots;
CREATE POLICY "farm_plots_modify_policy" ON public.farm_plots
    FOR ALL
    USING (farm_id IN (SELECT public.current_user_farm_ids()))
    WITH CHECK (farm_id IN (SELECT public.current_user_farm_ids()));

-- ------------------------------------------------------------------------------
-- farm_beds
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "farm_beds_select_policy" ON public.farm_beds;
CREATE POLICY "farm_beds_select_policy" ON public.farm_beds
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = farm_beds.plot_id
                  AND p.farm_id IN (SELECT public.current_user_farm_ids())
            )
            OR (
                public.current_user_role() = 'student'
                AND (
                    student_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = farm_beds.plot_id AND p.student_id = auth.uid()
                    )
                )
            )
        )
    );

DROP POLICY IF EXISTS "farm_beds_insert_policy" ON public.farm_beds;
CREATE POLICY "farm_beds_insert_policy" ON public.farm_beds
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

-- 変更前: <区画が自農園> AND (current_user_role() = 'teacher' OR student_id = auth.uid())
-- 生徒は従来どおり「自農園の区画にある自分の畝」のみ (列単位の制限はトリガー側)
DROP POLICY IF EXISTS "farm_beds_update_policy" ON public.farm_beds;
CREATE POLICY "farm_beds_update_policy" ON public.farm_beds
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id IN (SELECT public.current_user_farm_ids())
        )
        OR (
            student_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = farm_beds.plot_id AND p.farm_id = public.current_user_farm_id()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id IN (SELECT public.current_user_farm_ids())
        )
        OR (
            student_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = farm_beds.plot_id AND p.farm_id = public.current_user_farm_id()
            )
        )
    );

DROP POLICY IF EXISTS "farm_beds_delete_policy" ON public.farm_beds;
CREATE POLICY "farm_beds_delete_policy" ON public.farm_beds
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

-- ------------------------------------------------------------------------------
-- crop_records
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "crop_records_select_policy" ON public.crop_records;
CREATE POLICY "crop_records_select_policy" ON public.crop_records
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            -- 講師: 所属農園の畝・区画の記録
            (
                (bed_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.farm_beds b
                    JOIN public.farm_plots p ON p.id = b.plot_id
                    WHERE b.id = crop_records.bed_id
                      AND p.farm_id IN (SELECT public.current_user_farm_ids())
                ))
                OR (plot_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.farm_plots p
                    WHERE p.id = crop_records.plot_id
                      AND p.farm_id IN (SELECT public.current_user_farm_ids())
                ))
            )
            -- 生徒: 変更なし
            OR (
                public.current_user_role() = 'student'
                AND (
                    (bed_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.farm_beds b
                        WHERE b.id = crop_records.bed_id
                          AND (
                              b.student_id = auth.uid()
                              OR EXISTS (
                                  SELECT 1 FROM public.farm_plots p
                                  WHERE p.id = b.plot_id AND p.student_id = auth.uid()
                              )
                          )
                    ))
                    OR (plot_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = crop_records.plot_id AND p.student_id = auth.uid()
                    ))
                )
            )
        )
    );

DROP POLICY IF EXISTS "crop_records_modify_policy" ON public.crop_records;
CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL
    USING (
        auth.role() = 'authenticated'
        AND (
            -- 講師: 所属農園の畝・区画の記録 (畝と区画の整合を維持)
            (
                (bed_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.farm_beds b
                    JOIN public.farm_plots p ON p.id = b.plot_id
                    WHERE b.id = crop_records.bed_id
                      AND p.farm_id IN (SELECT public.current_user_farm_ids())
                      AND (crop_records.plot_id IS NULL OR crop_records.plot_id = b.plot_id)
                ))
                OR (crop_records.bed_id IS NULL AND crop_records.plot_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.farm_plots p
                    WHERE p.id = crop_records.plot_id
                      AND p.farm_id IN (SELECT public.current_user_farm_ids())
                ))
            )
            -- 生徒: 変更なし
            OR (
                public.current_user_role() = 'student'
                AND (
                    (bed_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.farm_beds b
                        WHERE b.id = crop_records.bed_id
                          AND (
                              b.student_id = auth.uid()
                              OR EXISTS (
                                  SELECT 1 FROM public.farm_plots p
                                  WHERE p.id = b.plot_id AND p.student_id = auth.uid()
                              )
                          )
                          AND (crop_records.plot_id IS NULL OR b.plot_id = crop_records.plot_id)
                    ))
                    OR (crop_records.bed_id IS NULL AND crop_records.plot_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = crop_records.plot_id AND p.student_id = auth.uid()
                    ))
                )
            )
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            (
                (bed_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.farm_beds b
                    JOIN public.farm_plots p ON p.id = b.plot_id
                    WHERE b.id = crop_records.bed_id
                      AND p.farm_id IN (SELECT public.current_user_farm_ids())
                      AND (crop_records.plot_id IS NULL OR crop_records.plot_id = b.plot_id)
                ))
                OR (crop_records.bed_id IS NULL AND crop_records.plot_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.farm_plots p
                    WHERE p.id = crop_records.plot_id
                      AND p.farm_id IN (SELECT public.current_user_farm_ids())
                ))
            )
            OR (
                public.current_user_role() = 'student'
                AND (
                    (bed_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.farm_beds b
                        WHERE b.id = crop_records.bed_id
                          AND (
                              b.student_id = auth.uid()
                              OR EXISTS (
                                  SELECT 1 FROM public.farm_plots p
                                  WHERE p.id = b.plot_id AND p.student_id = auth.uid()
                              )
                          )
                          AND (crop_records.plot_id IS NULL OR b.plot_id = crop_records.plot_id)
                    ))
                    OR (crop_records.bed_id IS NULL AND crop_records.plot_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = crop_records.plot_id AND p.student_id = auth.uid()
                    ))
                )
            )
        )
    );
