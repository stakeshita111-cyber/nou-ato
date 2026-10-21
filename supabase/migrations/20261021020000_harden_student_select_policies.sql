-- ==============================================================================
-- Migration: 20261021020000_harden_student_select_policies.sql
-- Description:
--   Issue #198: 同一農園内の受講生間における crop_records / farm_beds 参照権限の最小化
--   - farm_beds_select_policy:
--       - 講師: 自農園内の全区画の畝を閲覧可能
--       - 生徒: 自身が担当する畝、または自身が担当する区画の畝のみ閲覧可能 (他生徒の畝は非公開)
--   - crop_records_select_policy:
--       - 講師: 自農園内の全区画・全畝の記録を閲覧可能
--       - 生徒: 自身が担当する畝、または自身が担当する区画の記録のみ閲覧可能 (他生徒の記録は非公開)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. farm_beds_select_policy の厳格化 (生徒間の閲覧を完全分離)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "farm_beds_select_policy" ON public.farm_beds;

CREATE POLICY "farm_beds_select_policy" ON public.farm_beds
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            -- ① 講師: 自農園内の区画に属する畝をすべて閲覧可能
            (
                public.current_user_role() = 'teacher'
                AND EXISTS (
                    SELECT 1 FROM public.farm_plots p
                    WHERE p.id = farm_beds.plot_id
                      AND p.farm_id = public.current_user_farm_id()
                )
            )
            -- ② 受講生: 自身に割り当てられた畝、または自身が担当する区画内の畝のみ閲覧可能
            OR (
                public.current_user_role() = 'student'
                AND (
                    farm_beds.student_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = farm_beds.plot_id
                          AND p.student_id = auth.uid()
                    )
                )
            )
        )
    );

-- ------------------------------------------------------------------------------
-- 2. crop_records_select_policy の厳格化 (生徒間の閲覧を完全分離)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "crop_records_select_policy" ON public.crop_records;

CREATE POLICY "crop_records_select_policy" ON public.crop_records
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            -- ① 講師: 自農園内の畝・区画に紐づく記録をすべて閲覧可能
            (
                public.current_user_role() = 'teacher'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            JOIN public.farm_plots p ON p.id = b.plot_id
                            WHERE b.id = crop_records.bed_id
                              AND p.farm_id = public.current_user_farm_id()
                        )
                    )
                    OR (
                        crop_records.plot_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_plots p
                            WHERE p.id = crop_records.plot_id
                              AND p.farm_id = public.current_user_farm_id()
                        )
                    )
                )
            )
            -- ② 受講生: 自身が割り当てられた畝、または自身が担当する区画の記録のみ閲覧可能
            OR (
                public.current_user_role() = 'student'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            WHERE b.id = crop_records.bed_id
                              AND (
                                  b.student_id = auth.uid()
                                  OR EXISTS (
                                      SELECT 1 FROM public.farm_plots p
                                      WHERE p.id = b.plot_id AND p.student_id = auth.uid()
                                  )
                              )
                        )
                    )
                    OR (
                        crop_records.plot_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_plots p
                            WHERE p.id = crop_records.plot_id
                              AND p.student_id = auth.uid()
                        )
                    )
                )
            )
        )
    );
