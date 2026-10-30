"""Error patterns fixture."""

def risky_operation():
    try:
        val = 1 / 0
    except:  # bare except
        print("error")

def swallow_operation():
    try:
        data = None
        data.fetch()
    except Exception:
        pass  # empty catch

def base_exception_trap():
    try:
        import time
        time.sleep(1)
    except BaseException:
        pass  # catch BaseException
