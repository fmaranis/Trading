import importlib.util, pathlib, unittest
p=pathlib.Path(__file__).resolve().parents[1]/'scripts/coreOutperformanceHitRateAudit.py'
s=importlib.util.spec_from_file_location('audit',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class AuditTests(unittest.TestCase):
    def test_compound_not_sum(self): self.assertAlmostEqual(m.compound([10,-10]),-1)
    def test_rolling_count_and_gap(self):
        x={f'{2020+i//12}{i%12+1:02}':1 for i in range(24)}
        self.assertEqual(len(m.windows(x,1)),13);self.assertEqual(len(m.windows(x,12)),2)
        del x['202006']
        with self.assertRaisesRegex(ValueError,'MONTH_GAP'): m.windows(x,1)
    def test_ties_and_joint(self):
        rows=[{'period':'1','candidate':10,'SPY':9,'URTH':11}, {'period':'2','candidate':10,'SPY':10,'URTH':9}]
        y=m.compare_rows(rows,['SPY','URTH']);self.assertEqual(y['SPY']['wins'],1)
        self.assertEqual(y['SPY']['ties'],1);self.assertEqual(y['BOTH_SPY_URTH']['wins'],0)
    def test_missing_benchmark_no_renormalization(self):
        with self.assertRaisesRegex(ValueError,'MISSING_BENCHMARK'):m.benchmark_months({},['202001'])
    def test_duplicate_price_rejected(self):
        row={'symbol':'SPY','date':'2020-01-31','adjustedClose':100}
        with self.assertRaisesRegex(ValueError,'DUPLICATE'):m.price_map({'provenance':'REAL','currency':'USD','property':'AdjustedClose','rows':[row,row]})
    def test_no_iid_interval_on_overlap(self):
        self.assertIsNone(m.summary([1,2],['a','b'],False)['wilson95IidReference'])
    def test_zero_losses_null_and_probability_uncertainty(self):
        y=m.summary([1]*5,list('abcde'),True)
        self.assertIsNone(y['meanLossExcessPp']);self.assertLess(y['wilson95IidReference']['lowerPct'],80)
    def test_run_resets_across_gap(self):
        y=m.summary([-1]*4,list('abcd'),True,[0,0,1,1]);self.assertEqual(y['longestNonWinningRunWithinBlock'],2)
    def test_alignment_required(self):
        with self.assertRaisesRegex(ValueError,'BENCHMARK_COVERAGE'):m.compare_rows([{'period':'a','candidate':1}],['SPY'])
    def test_corrupt_series_rejected(self):
        with self.assertRaisesRegex(ValueError,'INVALID_RETURN'):m.check_series({'202001':float('nan')},1)
if __name__=='__main__':unittest.main()
