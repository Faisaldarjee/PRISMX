import os
import datetime
import schedule
import time
import json

from data.fetcher import DataFetcher
from ensemble.accuracy_tracker import run_daily_accuracy_check, update_weights_from_accuracy
from ensemble.orchestrator import run_all_predictions

def run_daily_pipeline():
    print(f"[{datetime.datetime.now().isoformat()}] Starting Astraeus Daily Automation Pipeline...")
    os.makedirs('logs', exist_ok=True)
    
    summary = {
        "timestamp": datetime.datetime.now().isoformat(),
        "steps": {}
    }

    # Step 1: fetch_all_new_data()
    try:
        print("\n--- Step 1: fetch_all_new_data() ---")
        DataFetcher.update_daily()
        summary["steps"]["fetch_all_new_data"] = "SUCCESS"
    except Exception as e:
        print(f"Error in Step 1: {e}")
        summary["steps"]["fetch_all_new_data"] = f"FAILED: {str(e)}"

    # Step 2: check_accuracy()
    try:
        print("\n--- Step 2: check_accuracy() ---")
        run_daily_accuracy_check()
        summary["steps"]["check_accuracy"] = "SUCCESS"
    except Exception as e:
        print(f"Error in Step 2: {e}")
        summary["steps"]["check_accuracy"] = f"FAILED: {str(e)}"

    # Step 3: update_weights()
    try:
        print("\n--- Step 3: update_weights() ---")
        res = update_weights_from_accuracy()
        summary["steps"]["update_weights"] = "SUCCESS"
        summary["update_weights_result"] = {
            "updated": res.get("updated", False),
            "reason": res.get("reason", "N/A")
        }
    except Exception as e:
        print(f"Error in Step 3: {e}")
        summary["steps"]["update_weights"] = f"FAILED: {str(e)}"

    # Step 4: generate_all_predictions()
    try:
        print("\n--- Step 4: generate_all_predictions() ---")
        predictions = run_all_predictions()
        summary["steps"]["generate_all_predictions"] = "SUCCESS"
        summary["predictions_generated"] = len(predictions)
    except Exception as e:
        print(f"Error in Step 4: {e}")
        summary["steps"]["generate_all_predictions"] = f"FAILED: {str(e)}"

    # Step 5: save_daily_log()
    try:
        print("\n--- Step 5: save_daily_log() ---")
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        log_file = os.path.join("logs", f"{today_str}.log")
        with open(log_file, "w") as f:
            f.write(f"ASTRAEUS PORTFOLIO INTELLIGENCE PIPELINE SUMMARY - {today_str}\n")
            f.write("=" * 70 + "\n")
            f.write(json.dumps(summary, indent=4))
        print(f"Daily pipeline log successfully saved to {log_file}")
        summary["steps"]["save_daily_log"] = "SUCCESS"
    except Exception as e:
        print(f"Error in Step 5: {e}")
        summary["steps"]["save_daily_log"] = f"FAILED: {str(e)}"

    print(f"\n[{datetime.datetime.now().isoformat()}] Astraeus daily automation pipeline run complete.")

if __name__ == "__main__":
    print("=" * 70)
    print("         ASTRAEUS SELF-LEARNING SCHEDULER DEPLOYED")
    print("=" * 70)
    print("Active Schedule: Daily at 16:00 IST (Market Close)")
    
    # Check for direct instant invocation command line utility
    import sys
    if "--now" in sys.argv:
        print("Instant execution command flag detected. Starting daily pipeline now...")
        run_daily_pipeline()

    schedule.every().day.at("16:00").do(run_daily_pipeline)

    print("\nScheduler daemon loaded and waiting. Keep target terminal execution active...")
    while True:
        schedule.run_pending()
        time.sleep(1)
