package festival

import "testing"

func TestValidate(t *testing.T) {
	valid := Festival{Name: "Diwali", StartDate: "2026-11-08", EndDate: "2026-11-10", SurgePaisa: 1500}
	if err := Validate(valid); err != nil {
		t.Fatalf("valid festival rejected: %v", err)
	}
	cases := []Festival{
		{Name: "", StartDate: "2026-11-08", EndDate: "2026-11-10"},
		{Name: "X", StartDate: "08-11-2026", EndDate: "2026-11-10"},
		{Name: "X", StartDate: "2026-11-10", EndDate: "2026-11-08"},
		{Name: "X", StartDate: "2026-11-08", EndDate: "2026-11-10", SurgePaisa: -1},
	}
	for i, c := range cases {
		if err := Validate(c); err == nil {
			t.Errorf("case %d must fail validation", i)
		}
	}
}
